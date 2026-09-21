import { Command } from '@core/decorators/command';
import { OnNuiEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { uuidv4, wait } from '@core/utils';
import { Notifier } from '@public/client/notifier';

import { NuiEvent } from '../../shared/event/nui';
import { Control } from '../../shared/input';
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
            console.error('[target-cursor] options du monde: erreur à la construction', error);

            return [];
        }
    }

    private async getSelfVehicleOptions(): Promise<TargetOption[]> {
        const vehicle = GetVehiclePedIsIn(PlayerPedId(), false);
        if (!vehicle) return [];

        // TODO: logs de diagnostic temporaires (F8), à retirer une fois le menu véhicule validé en jeu
        if (!this._selfVehicleOptions) {
            console.log('[target-cursor] menu véhicule: aucun fournisseur d’options enregistré');
            return [];
        }

        const entityCoords = GetEntityCoords(vehicle, true) as Vector3;
        let options: TargetOption[];

        try {
            options = await this._selfVehicleOptions(vehicle);
        } catch (error) {
            console.error('[target-cursor] menu véhicule: erreur à la construction des options', error);
            return [];
        }

        console.log(`[target-cursor] menu véhicule: ${options.length} options`);

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
                const sinceActivation = GetGameTimer() - this._cursorActivatedAt;

                // TODO: log de diagnostic temporaire (F8), à retirer une fois l'alt-tab validé en jeu
                console.log(`[target-cursor] relâchement de la touche ${sinceActivation}ms après l'ouverture`);

                if (sinceActivation < CURSOR_FOCUS_GRACE) return;
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

        if (this.playerService.getPlayer()?.metadata.isdead) {
            await this.resetTarget();
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
        // TODO: log de diagnostic temporaire (F8), à retirer une fois le menu véhicule validé en jeu
        console.log(
            `[target-cursor] clic: vehicule=${ownVehicle} entite_visee=${this._cursorHoverEntity} options_entite=${this._targetOptions.length}`
        );
        if (ownVehicle && (this._cursorHoverEntity === ownVehicle || this._targetOptions.length === 0)) {
            if (await this.openSelfVehicleMenu(position)) return;
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

    private async refreshCursorHover(force = false, cursor?: [number, number]): Promise<void> {
        if (force) {
            // Un clic doit toujours se baser sur un calcul frais, même si le tick de survol est en cours
            while (this._cursorRefreshing) await wait(0);
        } else if (this._cursorRefreshing) {
            return;
        }

        this._cursorRefreshing = true;

        try {
            const [entity, rayEndCoords, hit] = await this.screenService.getEntityOnPosition(
                cursor ?? this.getCursorPosition(),
                this._playerCoordsOverride
            );
            // Sans impact (ciel...), le rayon renvoie son point d'arrivée, 1000 m plus loin: ce n'est pas un point du
            // monde où l'on peut interagir ou placer quelque chose
            const entityCoords = hit ? rayEndCoords : null;

            // Le curseur a pu être fermé pendant le raycast
            if (!this._cursorMode || !this._targetActive) return;

            const hoverEntity = entity || 0;
            this._cursorHoverEntity = hoverEntity;
            this._cursorHoverCoords = entityCoords ?? null;
            const hoverCoords = entityCoords ?? this.getPlayerCoords();
            // Les zones (polyzone) dépendent du point touché, on affine donc par mètre quand aucune entité n'est visée
            const hoverKey = hoverEntity
                ? `entity:${hoverEntity}`
                : `world:${hoverCoords.map(c => Math.round(c)).join(':')}`;

            if (!force && hoverKey === this._cursorHoverKey) return;

            this._cursorHoverKey = hoverKey;

            this._targetOptions = entityCoords
                ? await this.checkTargetActions(
                      hoverEntity,
                      hoverCoords,
                      getDistance(hoverCoords, this.getPlayerCoords())
                  )
                : [];

            if (!this._cursorMode || !this._targetActive) return;

            if (force) {
                // TODO: log de diagnostic temporaire (F8), à retirer une fois le mode curseur validé en jeu
                const [centerEntity] = await this.screenService.getEntityOnPosition([0.5, 0.5]);
                console.log(
                    `[target-cursor] raycast curseur=${(cursor ?? this.getCursorPosition())
                        .map(c => c.toFixed(3))
                        .join(',')} jeu=${this.getCursorPosition()
                        .map(c => c.toFixed(3))
                        .join(',')} entite=${hoverEntity} type=${hoverEntity ? GetEntityType(hoverEntity) : '-'} ` +
                        `modele=${hoverEntity && GetEntityType(hoverEntity) !== 0 ? GetEntityModel(hoverEntity) : '-'} impact=${
                            entityCoords ? entityCoords.map(c => c.toFixed(1)).join(',') : 'aucun'
                        } distance=${
                            entityCoords ? getDistance(hoverCoords, this.getPlayerCoords()).toFixed(1) : '-'
                        } options=${this._targetOptions.length} entite_centre=${centerEntity}`
                );
            }

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
