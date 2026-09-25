import { Command } from '@core/decorators/command';
import { OnNuiEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { uuidv4, wait } from '@core/utils';
import { Notifier } from '@public/client/notifier';
import { ContextMenuGrouping } from '@public/config/context-menu';

import { NuiEvent } from '../../shared/event/nui';
import { Control } from '../../shared/input';
import { JobLabel, JobType } from '../../shared/job';
import { TargetCursorMenuPosition } from '../../shared/nui/target';
import { getDistance, Vector3 } from '../../shared/polyzone/vector';
import { TargetMode, TargetOption } from '../../shared/target';
import { HudWatchProvider } from '../hud/hud.watch.provider';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PhoneManager } from '../phone/phone.manager';
import { PlayerService } from '../player/player.service';
import { ScreenService } from '../screen.service';
import { TargetService } from './target.service';
import { TargetStore, TargetStoreBase } from './target.store';

const MAX_DISTANCE = 50;

// Après l'ouverture du curseur, le NUI prend le focus et le jeu reçoit un faux relâchement de la touche: on l'ignore
// pendant ce délai (ms)
const CURSOR_FOCUS_GRACE = 800;

// Tolérance au clic: rayons supplémentaires tirés autour du point cliqué quand le rayon exact ne trouve rien. Deux
// anneaux de CLICK_TOLERANCE_POINTS rayons, à ces rayons (fraction de la hauteur de l'écran: 0.01 ≈ 11 px à 1080p)
const CLICK_TOLERANCE_RADII = [0.006, 0.014];
const CLICK_TOLERANCE_POINTS = 8;

// Squelette du joueur pour savoir si un clic est sur son corps: segments entre deux os, avec l'épaisseur du corps à cet
// endroit (m). La capsule de collision du ped est bien plus large que son skin, on ne s'y fie donc pas seule.
const BONE = {
    head: 31086,
    neck: 39317,
    spine3: 24818,
    spine0: 23553,
    pelvis: 11816,
    lThigh: 58271,
    lCalf: 63931,
    lFoot: 14201,
    rThigh: 51826,
    rCalf: 36864,
    rFoot: 52301,
    lUpperArm: 45509,
    lForearm: 61163,
    lHand: 18905,
    rUpperArm: 40269,
    rForearm: 28252,
    rHand: 57005,
};
const PLAYER_BODY_SEGMENTS: [number, number, number][] = [
    [BONE.head, BONE.neck, 0.15],
    [BONE.neck, BONE.spine3, 0.2],
    [BONE.spine3, BONE.spine0, 0.2],
    [BONE.spine0, BONE.pelvis, 0.2],
    [BONE.pelvis, BONE.lThigh, 0.14],
    [BONE.lThigh, BONE.lCalf, 0.12],
    [BONE.lCalf, BONE.lFoot, 0.1],
    [BONE.pelvis, BONE.rThigh, 0.14],
    [BONE.rThigh, BONE.rCalf, 0.12],
    [BONE.rCalf, BONE.rFoot, 0.1],
    [BONE.spine3, BONE.lUpperArm, 0.12],
    [BONE.lUpperArm, BONE.lForearm, 0.1],
    [BONE.lForearm, BONE.lHand, 0.09],
    [BONE.spine3, BONE.rUpperArm, 0.12],
    [BONE.rUpperArm, BONE.rForearm, 0.1],
    [BONE.rForearm, BONE.rHand, 0.09],
];

@Provider()
export class TargetProvider {
    @Inject(TargetStore)
    private readonly targetStore: TargetStore;

    @Inject(NuiDispatch)
    private readonly nuiDispatch: NuiDispatch;

    @Inject(ScreenService)
    private readonly screenService: ScreenService;

    @Inject(TargetService)
    private readonly targetService: TargetService;

    @Inject(PlayerService)
    private readonly playerService: PlayerService;

    @Inject(Notifier)
    private readonly notifier: Notifier;

    @Inject(PhoneManager)
    private readonly phoneManager: PhoneManager;

    @Inject(HudWatchProvider)
    private readonly hudWatchProvider: HudWatchProvider;

    private _targetActive = false;
    private _targetFound = false;
    private _targetOptions: TargetOption[] = [];
    private _targetLocked: boolean;

    private _playerCoordsOverride: Vector3 | null;

    private _activeTargetedEntity: Array<number> = [];

    private _debugPoly = false;

    // Mode "menu contextuel": curseur libre, les options sont calculées pour l'entité sous la souris
    private _cursorMode = false;
    private _cursorMenuOpen = false;
    private _cursorHoverKey: string | null = null;
    private _cursorHoverEntity = 0;
    private _cursorHoverCoords: Vector3 | null = null;
    private _cursorActivatedAt = 0;
    private _cursorRefreshing = false;
    private _selfVehicleMenuOpen = false;

    // Options du menu "véhicule" affiché quand le joueur est dans un véhicule (fournies par le module vehicle)
    private _selfVehicleOptions: ((vehicle: number) => Promise<TargetOption[]>) | null = null;

    // Options d'un point du monde, affichées en cliquant sur le sol ou sur un élément sans option (fournies par les
    // modules)
    private _worldOptions: ((coords: Vector3) => Promise<TargetOption[]>) | null = null;

    // Options affichées en cliquant sur son propre personnage (fournies par les modules)
    private _selfPedOptions: (() => Promise<TargetOption[]>) | null = null;

    // Options d'un véhicule cliqué de l'extérieur, calculées à chaque clic (libellés et états dynamiques: verrouillage,
    // portes, plaque...). Fournies par les modules, en plus des cibles B-Target déjà enregistrées.
    private _vehicleOptions:
        | ((vehicle: number, context: { coords: Vector3; distance: number }) => Promise<TargetOption[]>)
        | null = null;

    // Regroupe les options d'entreprise d'une cible en sous-menus, d'après leur job (règles dans
    // config/context-menu.ts, ContextMenuGrouping). Les options qui ont déjà un sous-menu ne sont pas touchées.
    private groupOptions(options: TargetOption[]): TargetOption[] {
        const jobIds = (option: TargetOption): string[] => {
            if (typeof option.job === 'string') return [option.job];

            return option.job ? Object.keys(option.job) : [];
        };

        const jobGroup = (option: TargetOption): string | null => {
            const ids = jobIds(option);

            if (option.group || ids.length === 0) return null;

            const configured = ContextMenuGrouping.jobs.find(entry =>
                ids.every(id => entry.jobs.includes(id as JobType))
            );

            if (configured) return configured.label;

            // Un job seul, sans entrée dans la config, prend son nom complet
            return ids.length === 1 ? JobLabel[ids[0] as JobType] ?? ids[0] : null;
        };

        const counts = new Map<string, number>();

        for (const option of options) {
            const group = jobGroup(option);

            if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
        }

        return options.map(option => {
            const group = jobGroup(option);

            // Pas assez d'options de ce job sur cette cible: elles restent à plat
            if (!group || counts.get(group) <= ContextMenuGrouping.minOptions) return option;

            const subGroup = ContextMenuGrouping.subGroups.find(entry => entry.labels.includes(option.label));

            return { ...option, group: subGroup ? `${group}/${subGroup.group}` : group };
        });
    }

    @Command('+target', {
        description: 'Activer le mode ciblage',
        keys: [{ mapper: 'keyboard', key: 'LMENU' }],
    })
    public async enableTargetMode(): Promise<void> {
        if (this._targetLocked) return;

        this._targetActive = true;
        this._targetFound = false;
        this._cursorMode = this.hudWatchProvider.targetMode === TargetMode.Cursor;
        this._cursorActivatedAt = GetGameTimer();
        this.nuiDispatch.dispatch('target', 'SetTargetMode', this._cursorMode ? TargetMode.Cursor : TargetMode.Crosshair);
        this.nuiDispatch.dispatch('target', 'SetTargeting', this._targetActive);

        if (this._cursorMode) {
            SetCursorLocation(0.5, 0.5);
            return;
        }

        await this.findTargets();
    }

    public registerSelfVehicleOptions(factory: (vehicle: number) => Promise<TargetOption[]>): void {
        this._selfVehicleOptions = factory;
    }

    public registerWorldOptions(factory: (coords: Vector3) => Promise<TargetOption[]>): void {
        this._worldOptions = factory;
    }

    public registerVehicleOptions(
        factory: (vehicle: number, context: { coords: Vector3; distance: number }) => Promise<TargetOption[]>
    ): void {
        this._vehicleOptions = factory;
    }

    private async getVehicleOptions(vehicle: number, coords: Vector3, distance: number): Promise<TargetOption[]> {
        if (!this._vehicleOptions) return [];

        try {
            const options = await this._vehicleOptions(vehicle, { coords, distance });

            return options.map(option => ({
                category: 'citizen',
                ...option,
                id: uuidv4(),
                entity: vehicle,
                entityCoords: coords,
            }));
        } catch (error) {
            console.error('[context-menu] options du véhicule: erreur à la construction', error);

            return [];
        }
    }

    public registerSelfPedOptions(factory: () => Promise<TargetOption[]>): void {
        this._selfPedOptions = factory;
    }

    private async getSelfPedOptions(): Promise<TargetOption[]> {
        if (!this._selfPedOptions) return [];

        const ped = PlayerPedId();

        try {
            const options = await this._selfPedOptions();

            return options.map(option => ({
                category: 'citizen',
                ...option,
                id: uuidv4(),
                entity: ped,
                entityCoords: GetEntityCoords(ped, true) as Vector3,
            }));
        } catch (error) {
            console.error('[context-menu] options du joueur: erreur à la construction', error);

            return [];
        }
    }

    // Le rayon du curseur ignore le ped du joueur (sinon il le toucherait toujours). Pour savoir si on clique sur son
    // personnage:
    // 1. un rayon qui ne l'ignore pas doit le toucher en premier (une voiture ou un objet devant passe avant lui);
    // 2. ce rayon doit passer près de son squelette: la capsule de collision du ped est plus large que son skin, on
    //    ne se fie donc pas à elle seule.
    private async isCursorOverPlayer(cursor: [number, number]): Promise<boolean> {
        const ped = PlayerPedId();
        const [entity, , hit] = await this.screenService.getEntityOnPosition(
            cursor,
            this._playerCoordsOverride,
            undefined,
            true
        );

        if (!hit || entity !== ped) return false;

        const [origin, direction] = this.screenService.getCursorRay(cursor, this._playerCoordsOverride);
        const directionLength = getDistance([0, 0, 0], direction);

        if (directionLength === 0) return false;

        // Distance d'un point au rayon (le rayon ne va que vers l'avant)
        const distanceToRay = (point: Vector3): number => {
            const offset: Vector3 = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
            const along = Math.max(
                0,
                (offset[0] * direction[0] + offset[1] * direction[1] + offset[2] * direction[2]) / directionLength ** 2
            );
            const closest: Vector3 = [
                origin[0] + direction[0] * along,
                origin[1] + direction[1] * along,
                origin[2] + direction[2] * along,
            ];

            return getDistance(point, closest);
        };

        return PLAYER_BODY_SEGMENTS.some(([boneA, boneB, radius]) => {
            const from = GetPedBoneCoords(ped, boneA, 0, 0, 0) as Vector3;
            const to = GetPedBoneCoords(ped, boneB, 0, 0, 0) as Vector3;

            // Le segment est échantillonné: on cherche son point le plus proche du rayon
            for (let i = 0; i <= 4; i++) {
                const t = i / 4;
                const point: Vector3 = [
                    from[0] + (to[0] - from[0]) * t,
                    from[1] + (to[1] - from[1]) * t,
                    from[2] + (to[2] - from[2]) * t,
                ];

                if (distanceToRay(point) <= radius) return true;
            }

            return false;
        });
    }

    private async getWorldOptions(coords: Vector3): Promise<TargetOption[]> {
        if (!this._worldOptions) return [];

        try {
            const options = await this._worldOptions(coords);

            return options.map(option => ({
                category: 'citizen',
                ...option,
                id: uuidv4(),
                entity: 0,
                entityCoords: coords,
            }));
        } catch (error) {
            console.error('[context-menu] options du monde: erreur à la construction', error);

            return [];
        }
    }

    private async getSelfVehicleOptions(): Promise<TargetOption[]> {
        const vehicle = GetVehiclePedIsIn(PlayerPedId(), false);
        if (!vehicle) return [];

        if (!this._selfVehicleOptions) return [];

        const entityCoords = GetEntityCoords(vehicle, true) as Vector3;
        let options: TargetOption[];

        try {
            options = await this._selfVehicleOptions(vehicle);
        } catch (error) {
            console.error('[context-menu] menu véhicule: erreur à la construction des options', error);
            return [];
        }

        return options.map(option => ({ category: 'citizen', ...option, id: uuidv4(), entity: vehicle, entityCoords }));
    }

    private async openSelfVehicleMenu(position: TargetCursorMenuPosition): Promise<boolean> {
        const options = await this.getSelfVehicleOptions();

        // Le mode a pu être fermé pendant le calcul
        if (!this._cursorMode || !this._targetActive || options.length === 0) return false;

        this._targetOptions = options;
        this._cursorMenuOpen = true;
        this._selfVehicleMenuOpen = true;
        this.nuiDispatch.dispatch('target', 'SetTargets', this.serializeOptions(this._targetOptions));
        this.nuiDispatch.dispatch('target', 'SetCursorMenu', position);

        return true;
    }

    // Les fonctions ne passent pas au NUI: on y résout l'état des interrupteurs calculés à chaque affichage
    private serializeOptions(options: TargetOption[]): TargetOption[] {
        return options.map(option =>
            option.isChecked ? { ...option, checked: option.isChecked(), isChecked: undefined } : option
        );
    }

    // Rafraîchit le menu ouvert après une action qui le garde ouvert (interrupteurs, états recalculés)
    private async refreshOpenMenu(): Promise<void> {
        if (this._selfVehicleMenuOpen) {
            return this.refreshSelfVehicleMenu();
        }

        if (this._cursorMode && this._targetActive && this._cursorMenuOpen) {
            this.nuiDispatch.dispatch('target', 'SetTargets', this.serializeOptions(this._targetOptions));
        }
    }

    private async refreshSelfVehicleMenu(): Promise<void> {
        const options = await this.getSelfVehicleOptions();
        // Le menu a pu être fermé, ou remplacé par celui d'une autre entité, pendant le calcul
        if (!this._cursorMode || !this._targetActive || !this._selfVehicleMenuOpen) return;

        // Plus dans le véhicule (ou plus d'option): on ferme
        if (options.length === 0) {
            await this.resetTarget();
            return;
        }

        this._targetOptions = options;
        this.nuiDispatch.dispatch('target', 'SetTargets', this.serializeOptions(this._targetOptions));
    }

    @Command('-target')
    public async disableTargetMode(force?: boolean): Promise<void> {
        if (!this._targetActive) return;

        if (!force) {
            if (this._cursorMode) {
                // Quand le NUI prend le focus clavier, le jeu reçoit un faux relâchement de la touche juste après
                // l'ouverture: on l'ignore pendant un court délai. Ensuite tout relâchement ferme le mode, y compris
                // celui envoyé par le jeu quand la fenêtre perd le focus (alt-tab), que le NUI ne verrait jamais.
                if (GetGameTimer() - this._cursorActivatedAt < CURSOR_FOCUS_GRACE) return;
            } else if (IsNuiFocused()) {
                // B-Target: le NUI ferme lui-même (keyup) une fois qu'il a le focus
                return;
            }
        }

        if (force) {
            this._targetLocked = true;
            setTimeout(() => (this._targetLocked = false), 1000);
        }

        await this.resetTarget();
    }

    @Tick(50)
    public async checkTargetMode(): Promise<void> {
        if (this._cursorMode) return;
        if (!this._targetFound) return;

        const [entityId] = await this.screenService.getEntityOnPosition([0.5, 0.5], this._playerCoordsOverride);

        if (entityId !== 0) {
            this._activeTargetedEntity.push(entityId);
        }

        if (
            this._activeTargetedEntity.length >= 2 &&
            !this._targetOptions.some(t => this._activeTargetedEntity.includes(t.entity))
        ) {
            this._targetFound = false;
            setTimeout(() => this.resetTarget(), 2000);
        }

        if (this._activeTargetedEntity.length > 2) {
            this._activeTargetedEntity.shift();
        }
    }

    @Tick()
    public async disableActionsDuringTarget(): Promise<void> {
        if (!this._targetActive) return;

        SetPauseMenuActive(false);
        DisablePlayerFiring(PlayerId(), true);

        if (this._targetFound || this._cursorMode) {
            DisableControlAction(0, Control.LookLeftRight, true);
            DisableControlAction(0, Control.LookUpDown, true);
        }

        DisableControlAction(0, Control.Attack, true);
        DisableControlAction(0, Control.Aim, true);
        DisableControlAction(0, Control.SelectWeapon, true);
        DisableControlAction(0, Control.Detonate, true);
        DisableControlAction(0, Control.ThrowGrenade, true);
        DisableControlAction(0, Control.MeleeAttackLight, true);
        DisableControlAction(0, Control.MeleeAttackHeavy, true);
        DisableControlAction(0, Control.MeleeAttackAlternate, true);
        DisableControlAction(0, Control.MeleeBlock, true);
        DisableControlAction(0, Control.Attack2, true);
        DisableControlAction(0, Control.MeleeAttack1, true);
        DisableControlAction(0, Control.MeleeAttack2, true);

        // En véhicule, "Alt maintenu + clic" déclenche la mêlée depuis la fenêtre (le doigt d'honneur) et les clics
        // tirent en driveby: on désactive ces contrôles tant que le ciblage est actif
        DisableControlAction(0, Control.VehicleMeleeHold, true);
        DisableControlAction(0, Control.VehicleMeleeLeft, true);
        DisableControlAction(0, Control.VehicleMeleeRight, true);
        DisableControlAction(0, Control.VehicleAttack, true);
        DisableControlAction(0, Control.VehicleAttack2, true);
        DisableControlAction(0, Control.VehicleAim, true);
        DisableControlAction(0, Control.VehiclePassengerAttack, true);
        DisableControlAction(0, Control.VehiclePassengerAim, true);
    }

    public async findTargets(): Promise<void> {
        if (!this._targetActive) return;
        if (IsNuiFocused()) return;

        const [entityId, entityCoords] = await this.screenService.getEntityOnPosition(
            [0.5, 0.5],
            this._playerCoordsOverride
        );
        const playerDistance = getDistance(entityCoords, this.getPlayerCoords());

        this._targetOptions = await this.checkTargetActions(entityId, entityCoords, playerDistance);

        this._targetFound = this._targetOptions.length > 0;
        this.nuiDispatch.dispatch('target', 'SetTargetFound', this._targetFound);

        if (this._targetFound) {
            this.nuiDispatch.dispatch('target', 'SetTargets', this._targetOptions);
            SetCursorLocation(0.5, 0.5);
            return;
        }

        return this.findTargets();
    }

    @Tick(100)
    public async checkCursorHover(): Promise<void> {
        if (!this._cursorMode || !this._targetActive) return;

        // Alt-tab: le jeu ne reçoit jamais le relâchement d'Alt, on ferme pour ne pas garder le curseur bloqué
        // (native absente des typings: appel gardé, ignoré si elle n'existe pas dans cette version de FXServer)
        const isGameWindowFocused = (globalThis as { IsGameWindowFocused?: () => boolean }).IsGameWindowFocused;
        if (isGameWindowFocused && !isGameWindowFocused()) {
            await this.resetTarget();
            return;
        }

        if (this._cursorMenuOpen) return;

        // Mort: le menu ne sert plus, sauf s'il propose des options sur soi (un admin qui veut se réanimer). Les autres
        // entités sont de toute façon bloquées par la vérification générale des cibles: pas de survol à calculer.
        if (this.playerService.getPlayer()?.metadata.isdead) {
            if ((await this.getSelfPedOptions()).length === 0) {
                await this.resetTarget();
            }

            return;
        }

        await this.refreshCursorHover();
    }

    @OnNuiEvent(NuiEvent.TargetCursorClick)
    public async cursorClick(position: TargetCursorMenuPosition): Promise<void> {
        if (!this._cursorMode || !this._targetActive) return;

        // Un clic dans le vide ferme le menu ouvert, puis peut en rouvrir un sur l'entité visée
        this._cursorMenuOpen = false;
        this._selfVehicleMenuOpen = false;
        this.nuiDispatch.dispatch('target', 'SetCursorMenu', null);

        // La position envoyée par le NUI est exacte, on l'utilise plutôt que GetNuiCursorPosition
        await this.refreshCursorHover(true, [position.x, position.y]);

        // Dans un véhicule, cliquer dans le vide (ou sur son propre véhicule) ouvre le menu du véhicule
        const ownVehicle = GetVehiclePedIsIn(PlayerPedId(), false);
        if (ownVehicle && (this._cursorHoverEntity === ownVehicle || this._targetOptions.length === 0)) {
            if (await this.openSelfVehicleMenu(position)) return;
        }

        // Clic sur son propre personnage: ses options ont la priorité sur ce qui se trouve derrière lui
        if (await this.isCursorOverPlayer([position.x, position.y])) {
            const selfOptions = await this.getSelfPedOptions();

            // Le mode a pu être fermé pendant le calcul
            if (!this._cursorMode || !this._targetActive) return;

            if (selfOptions.length > 0) {
                this._targetOptions = selfOptions;
            }
        }

        // Sol ou élément sans option: options du monde à ce point (ex: "Placer" pour les admins)
        if (this._targetOptions.length === 0 && this._cursorHoverCoords) {
            const worldOptions = await this.getWorldOptions(this._cursorHoverCoords);

            // Le mode a pu être fermé pendant le calcul
            if (!this._cursorMode || !this._targetActive) return;

            this._targetOptions = worldOptions;
        }

        if (this._targetOptions.length === 0) {
            this.nuiDispatch.dispatch('target', 'SetTargets', []);
            return;
        }

        this._cursorMenuOpen = true;
        this.nuiDispatch.dispatch('target', 'SetTargets', this.serializeOptions(this._targetOptions));
        this.nuiDispatch.dispatch('target', 'SetCursorMenu', position);
    }

    // Les options d'une entité touchée par le curseur; joueurs, PNJ et véhicules: options d'entreprise rangées en
    // sous-menus
    private async computeEntityOptions(entity: number, coords: Vector3): Promise<TargetOption[]> {
        const distance = getDistance(coords, this.getPlayerCoords());
        const options = await this.checkTargetActions(entity, coords, distance);

        if (entity !== 0) {
            const entityType = GetEntityType(entity);

            // Véhicule: les options de base (verrouillage, coffre, portes...) s'ajoutent aux cibles enregistrées
            if (entityType === 2) {
                options.push(...(await this.getVehicleOptions(entity, coords, distance)));
            }

            if (entityType === 1 || entityType === 2) {
                return this.groupOptions(options);
            }
        }

        return options;
    }

    // Cherche une entité avec des options juste autour du curseur: deux anneaux de rayons (rayon en fraction de la
    // hauteur de l'écran), du plus proche au plus éloigné
    private async findOptionsNearCursor(
        cursor: [number, number],
        skipEntity: number
    ): Promise<{ entity: number; coords: Vector3; options: TargetOption[] } | null> {
        const [screenWidth, screenHeight] = GetActiveScreenResolution();
        // Pour que les anneaux soient ronds à l'écran et pas étirés
        const ratio = screenHeight / screenWidth;
        const points: [number, number][] = [];

        for (const radius of CLICK_TOLERANCE_RADII) {
            for (let i = 0; i < CLICK_TOLERANCE_POINTS; i++) {
                const angle = (i / CLICK_TOLERANCE_POINTS) * Math.PI * 2;

                points.push([cursor[0] + Math.cos(angle) * radius * ratio, cursor[1] + Math.sin(angle) * radius]);
            }
        }

        const results = await Promise.all(
            points.map(point => this.screenService.getEntityOnPosition(point, this._playerCoordsOverride))
        );
        const seen = new Set<number>([skipEntity]);

        for (const [entity, coords, hit] of results) {
            if (!hit || !entity || seen.has(entity) || GetEntityType(entity) === 0) continue;

            seen.add(entity);

            const options = await this.computeEntityOptions(entity, coords);

            if (options.length > 0) return { entity, coords, options };
        }

        return null;
    }

    private async refreshCursorHover(force = false, cursor?: [number, number]): Promise<void> {
        if (force) {
            // Un clic doit toujours se baser sur un calcul frais, même si le tick de survol est en cours
            while (this._cursorRefreshing) await wait(0);
        } else if (this._cursorRefreshing) {
            return;
        }

        this._cursorRefreshing = true;

        try {
            const cursorPosition = cursor ?? this.getCursorPosition();
            const [entity, rayEndCoords, hit] = await this.screenService.getEntityOnPosition(
                cursorPosition,
                this._playerCoordsOverride
            );
            // Sans impact (ciel...), le rayon renvoie son point d'arrivée, 1000 m plus loin: ce n'est pas un point du
            // monde où l'on peut interagir ou placer quelque chose
            let entityCoords = hit ? rayEndCoords : null;

            // Le curseur a pu être fermé pendant le raycast
            if (!this._cursorMode || !this._targetActive) return;

            let hoverEntity = entity || 0;
            // Les zones (polyzone) dépendent du point touché, on affine donc par mètre quand aucune entité n'est visée
            const hoverKey = hoverEntity
                ? `entity:${hoverEntity}`
                : `world:${(entityCoords ?? this.getPlayerCoords()).map(c => Math.round(c)).join(':')}`;

            if (!force && hoverKey === this._cursorHoverKey) return;

            this._cursorHoverKey = hoverKey;

            let options = entityCoords ? await this.computeEntityOptions(hoverEntity, entityCoords) : [];

            // Au clic: la coque de collision d'un véhicule est simplifiée et laisse des trous près des bords (coffre,
            // pare-chocs...). Le B-Target les rattrape en relançant son rayon à chaque image; ici on n'a qu'un rayon, on
            // en tire donc quelques autres juste autour du point cliqué.
            if (force && options.length === 0) {
                const nearby = await this.findOptionsNearCursor(cursorPosition, hoverEntity);

                if (nearby) {
                    hoverEntity = nearby.entity;
                    entityCoords = nearby.coords;
                    options = nearby.options;
                }
            }

            if (!this._cursorMode || !this._targetActive) return;

            this._cursorHoverEntity = hoverEntity;
            this._cursorHoverCoords = entityCoords;
            this._targetOptions = options;

            // Le rond ne signale que les vrais éléments (ped, véhicule, objet), pas le sol ni le décor, même quand une
            // zone y a des options (le clic fonctionne quand même)
            const found = this._targetOptions.length > 0 && hoverEntity !== 0 && GetEntityType(hoverEntity) !== 0;
            if (found !== this._targetFound) {
                this._targetFound = found;
                this.nuiDispatch.dispatch('target', 'SetCursorHover', found);
            }
        } finally {
            this._cursorRefreshing = false;
        }
    }

    private getCursorPosition(): [number, number] {
        const [screenX, screenY] = GetActiveScreenResolution();
        const [x, y] = GetNuiCursorPosition();

        return [x / screenX, y / screenY];
    }

    @OnNuiEvent(NuiEvent.TargetReset)
    public async reset(): Promise<void> {
        return this.resetTarget();
    }

    @OnNuiEvent(NuiEvent.TargetSelect)
    public async select(id: string): Promise<void> {
        const option = this._targetOptions.find(t => t.id === id);
        if (!option) return;

        if (option.blackoutGlobal) {
            await this.phoneManager.stopPhoneCall();
        }

        const distance = getDistance(this.getPlayerCoords(), option.entityCoords);
        if (distance > option.distance) {
            this.notifier.error('Vous êtes trop loin pour effectuer cette action');
            return;
        }

        if (option.keepOpen && this._cursorMode) {
            await option.action?.(option.entity, option.entityCoords);
            // Laisse le temps à l'état (serveur / natives) de se mettre à jour avant de recalculer les options
            await wait(150);
            // Seconde lecture une fois les animations terminées (portes, toit...), pour corriger un éventuel écart
            setTimeout(() => this.refreshOpenMenu(), 1500);
            return this.refreshOpenMenu();
        }

        option?.action(option?.entity, option.entityCoords);

        return this.disableTargetMode(true);
    }

    public isActive(): boolean {
        return this._targetActive;
    }

    public isCursorMode(): boolean {
        return this._cursorMode;
    }

    public setPlayerPosition(coords: Vector3 | null): void {
        this._playerCoordsOverride = coords;
    }

    protected async checkTargetActions(
        entity: number,
        entityCoords: Vector3,
        playerDistance: number
    ): Promise<TargetOption[]> {
        const targetsFound: TargetOption[] = [];

        const entityTargets = await this.checkTargetEntityActions(entity, entityCoords, playerDistance);
        targetsFound.push(...entityTargets);

        const modelTargets = await this.checkTargetModelActions(entity, entityCoords, playerDistance);
        targetsFound.push(...modelTargets);

        const pedTargets = await this.checkTargetPedActions(entity, entityCoords, playerDistance);
        targetsFound.push(...pedTargets);

        const vehicleTargets = await this.checkTargetVehicleActions(entity, entityCoords, playerDistance);
        targetsFound.push(...vehicleTargets);

        const boneTargets = await this.checkTargetBoneActions(entity);
        targetsFound.push(...boneTargets);

        const playerPosition = GetEntityCoords(PlayerPedId(), true) as Vector3;
        const nearbyZones = this.targetStore.zones.find(([, { zone }]) =>
            'center' in zone ? getDistance(zone.center, playerPosition) <= MAX_DISTANCE : true
        );

        if (nearbyZones && nearbyZones.length > 0) {
            for (const [id, { zone, targets, distance }] of nearbyZones) {
                if (this._debugPoly) zone.draw([0, 255, 0, 100], 0.5, id);
                if (playerDistance > distance) continue;

                if (zone.isPointInside(entityCoords)) {
                    for (const target of targets) {
                        const isValid = await this.targetService.validateTarget(target, entity);

                        if (isValid) {
                            // enforce citizen category to avoid issues with the migration
                            targetsFound.push({ category: 'citizen', ...target, id: uuidv4(), entity, entityCoords });
                        }
                    }
                }
            }
        }

        return targetsFound;
    }

    protected async checkTargetEntityActions(
        entity: number,
        entityCoords: Vector3,
        playerDistance: number
    ): Promise<TargetOption[]> {
        const entityType = GetEntityType(entity);
        if (entityType < 3) return [];

        const entityStore = this.targetStore.entities.find(([, target]) => target.entity === entity);

        return this.checkTargetGenericActions(entityStore, playerDistance, entity, entityCoords);
    }

    protected async checkTargetModelActions(
        entity: number,
        entityCoords: Vector3,
        playerDistance: number
    ): Promise<TargetOption[]> {
        const entityType = GetEntityType(entity);
        if (entityType === 0) return [];

        const model = this.targetStore.getId(GetEntityModel(entity));
        const modelStore = this.targetStore.models.find(([, target]) => target.model.toString() === model.toString());

        return this.checkTargetGenericActions(modelStore, playerDistance, entity, entityCoords);
    }

    protected async checkTargetPedActions(
        entity: number,
        entityCoords: Vector3,
        playerDistance: number
    ): Promise<TargetOption[]> {
        const playerPed = PlayerPedId();
        if (entity === playerPed) return [];

        const entityType = GetEntityType(entity);
        if (entityType !== 1) return [];

        const player = this.playerService.getState();

        if (IsPedAPlayer(entity)) {
            if (player.isInHub || player.isInGameHub) return [];

            const playerStore = this.targetStore.players.find(([, target]) => target.player === -1);
            return this.checkTargetGenericActions(playerStore, playerDistance, entity, entityCoords);
        }

        const pedStore = this.targetStore.peds.find(([, target]) => target.ped === -1);
        return this.checkTargetGenericActions(pedStore, playerDistance, entity, entityCoords);
    }

    protected async checkTargetVehicleActions(
        entity: number,
        entityCoords: Vector3,
        playerDistance: number
    ): Promise<TargetOption[]> {
        const entityType = GetEntityType(entity);
        if (entityType !== 2) return [];

        const vehicleStore = this.targetStore.vehicles.find(([, target]) => target.vehicle === -1);

        return this.checkTargetGenericActions(vehicleStore, playerDistance, entity, entityCoords);
    }

    protected async checkTargetBoneActions(entity: number): Promise<TargetOption[]> {
        const targetOptions: TargetOption[] = [];

        const playerCoords = this.getPlayerCoords();

        for (const [id, store] of this.targetStore.bones.getAll()) {
            const boneId = GetEntityBoneIndexByName(entity, store.bone);
            const bonePos = GetWorldPositionOfEntityBone(entity, boneId) as Vector3;
            const boneDistance = getDistance(playerCoords, bonePos);

            const options = await this.checkTargetGenericActions([[id, store]], boneDistance, entity, bonePos);
            targetOptions.push(...options);
        }

        return targetOptions;
    }

    protected async checkTargetGenericActions(
        store: [string, TargetStoreBase][],
        playerDistance: number,
        entity: number,
        entityCoords: Vector3
    ): Promise<TargetOption[]> {
        const targetsFound: TargetOption[] = [];
        if (!store || store.length === 0) return targetsFound;

        for (const [, targetStore] of store) {
            for (const target of targetStore.targets) {
                if (playerDistance > target.distance) continue;

                const isValid = await this.targetService.validateTarget(target, entity);
                if (isValid) {
                    // enforce citizen category to avoid issues with the migration
                    targetsFound.push({ category: 'citizen', ...target, id: uuidv4(), entity, entityCoords });
                }
            }
        }

        return targetsFound;
    }

    protected getPlayerCoords(): Vector3 {
        return this._playerCoordsOverride ?? (GetEntityCoords(PlayerPedId(), true) as Vector3);
    }

    protected async resetTarget(): Promise<void> {
        const wasCursorMode = this._cursorMode;

        this._targetActive = false;
        this._targetFound = false;
        this._targetOptions = [];
        this._activeTargetedEntity = [];
        this._cursorMode = false;
        this._cursorMenuOpen = false;
        this._selfVehicleMenuOpen = false;
        this._cursorHoverKey = null;
        this._cursorHoverEntity = 0;
        this._cursorHoverCoords = null;
        this.nuiDispatch.dispatch('target', 'SetTargeting', this._targetActive);
        this.nuiDispatch.dispatch('target', 'SetTargetFound', this._targetFound);
        this.nuiDispatch.dispatch('target', 'SetTargets', this._targetOptions);

        if (wasCursorMode) {
            this.nuiDispatch.dispatch('target', 'SetCursorHover', false);
            this.nuiDispatch.dispatch('target', 'SetCursorMenu', null);
        }
    }

    public setDebugPoly(value: boolean) {
        this._debugPoly = value;
    }

    public isDebugPoly() {
        return this._debugPoly;
    }
}
