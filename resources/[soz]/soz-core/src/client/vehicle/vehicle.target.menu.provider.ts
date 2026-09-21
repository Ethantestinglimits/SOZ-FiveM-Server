import { Once, OnceStep } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { TargetOption } from '@public/shared/target';
import { LSCustomMode, VehicleClass, VehicleSeat, VehicleVolatileState } from '@public/shared/vehicle/vehicle';

import { AdminMenuVehicleProvider } from '../admin/admin.menu.vehicle.provider';
import { AdminLevel, AdminPermissionService } from '../admin/admin.permission.service';
import { BennysVehicleProvider } from '../job/bennys/bennys.vehicle.provider';
import { PlayerService } from '../player/player.service';
import { TargetFactory } from '../target/target.factory';
import { TargetProvider } from '../target/target.provider';
import { VehicleDamageProvider } from './vehicle.damage.provider';
import { VehicleGarageProvider } from './vehicle.garage.provider';
import { VehicleLockProvider } from './vehicle.lock.provider';
import { VehicleMenuProvider } from './vehicle.menu.provider';
import { VehicleOffroadProvider } from './vehicle.offroad.provider';
import { VehicleSeatbeltProvider } from './vehicle.seatbelt.provider';
import { VehicleStateService } from './vehicle.state.service';

const DOORS: Record<number, string> = {
    0: 'Conducteur avant',
    1: 'Passager avant',
    2: 'Conducteur arrière',
    3: 'Passager arrière',
    4: 'Capot',
    5: 'Coffre',
};

const WINDOWS: Record<number, string> = {
    0: 'Conducteur avant',
    1: 'Passager avant',
    2: 'Arrière gauche',
    3: 'Arrière droite',
};

// Fenêtre correspondant à chaque place, pour les passagers qui ne peuvent gérer que la leur
const SEAT_WINDOW: Record<number, number> = {
    [VehicleSeat.Driver]: 0,
    [VehicleSeat.Copilot]: 1,
    [VehicleSeat.BackLeft]: 2,
    [VehicleSeat.BackRight]: 3,
};

const SEAT_LABELS: Record<number, string> = {
    [VehicleSeat.Driver]: 'Conducteur',
    [VehicleSeat.Copilot]: 'Passager avant',
    [VehicleSeat.BackLeft]: 'Arrière gauche',
    [VehicleSeat.BackRight]: 'Arrière droite',
};

const SPEED_LIMITS: { label: string; value: number | null }[] = [
    { label: 'Aucun', value: null },
    { label: '50 km/h', value: 50 },
    { label: '90 km/h', value: 90 },
    { label: '110 km/h', value: 110 },
    { label: '130 km/h', value: 130 },
];

// Durée pendant laquelle on affiche l'état demandé plutôt que l'état lu (animation d'une porte ~1s)
const EXPECTED_DELAY = 1300;

const GROUP_DOORS = 'Portes';
const GROUP_WINDOWS = 'Fenêtres';
const GROUP_LIGHTS = 'Éclairage';
const GROUP_SEATS = 'Sièges';
const GROUP_SPEED = 'Limiteur de vitesse';
const GROUP_ADMIN = '⚙️ Admin';
// Sous-onglets du menu admin ("/" sépare les niveaux)
const GROUP_ADMIN_CUSTOM = `${GROUP_ADMIN}/Personnalisation`;
const GROUP_ADMIN_SETTINGS = `${GROUP_ADMIN}/Réglages`;
const GROUP_ADMIN_MANAGE = `${GROUP_ADMIN}/Gestion`;

// Pas de limite de portée pour les outils admin sur un véhicule ciblé depuis l'extérieur (seule la portée du
// raycast de ciblage, 1000 m, s'applique)
const ADMIN_TARGET_DISTANCE = Infinity;

/**
 * Options du menu contextuel (mode curseur) quand le joueur est dans un véhicule.
 * Réutilise les actions du menu véhicule (touche HOME) et des commandes existantes.
 */
@Provider()
export class VehicleTargetMenuProvider {
    @Inject(TargetProvider)
    private targetProvider: TargetProvider;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(VehicleStateService)
    private vehicleStateService: VehicleStateService;

    @Inject(VehicleMenuProvider)
    private vehicleMenuProvider: VehicleMenuProvider;

    @Inject(VehicleLockProvider)
    private vehicleLockProvider: VehicleLockProvider;

    @Inject(VehicleSeatbeltProvider)
    private vehicleSeatbeltProvider: VehicleSeatbeltProvider;

    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(AdminMenuVehicleProvider)
    private adminMenuVehicleProvider: AdminMenuVehicleProvider;

    @Inject(VehicleDamageProvider)
    private vehicleDamageProvider: VehicleDamageProvider;

    @Inject(VehicleOffroadProvider)
    private vehicleOffroadProvider: VehicleOffroadProvider;

    @Inject(BennysVehicleProvider)
    private bennysVehicleProvider: BennysVehicleProvider;

    @Inject(AdminPermissionService)
    private adminPermissionService: AdminPermissionService;

    @Inject(VehicleGarageProvider)
    private vehicleGarageProvider: VehicleGarageProvider;

    // Aucune native ne permet de lire l'état d'une fenêtre: on retient celles qu'on a baissées, par véhicule
    private windowsDown = new Map<number, Set<number>>();

    // Portes, toit, moteur, feux... mettent du temps à atteindre leur état final (animation, démarrage): pendant ce
    // délai on affiche l'état demandé plutôt que l'état lu, qui serait encore l'ancien
    private expected = new Map<string, { value: boolean; until: number }>();
    private expectedSpeed = new Map<number, { value: number | null; until: number }>();

    // Interrupteurs sans état fiable à lire: dernière valeur appliquée, par véhicule
    private sticky = new Map<string, boolean>();

    private getExpected(key: string): boolean | undefined {
        const expected = this.expected.get(key);
        if (!expected) return undefined;

        if (expected.until < GetGameTimer()) {
            this.expected.delete(key);
            return undefined;
        }

        return expected.value;
    }

    @Once(OnceStep.Start)
    public onStart(): void {
        this.targetProvider.registerSelfVehicleOptions(vehicle => this.buildOptions(vehicle));
        this.registerAdminTargets();
    }

    // Outils admin: mêmes actions et mêmes règles de rôle que le sous-menu véhicule du menu admin. Chaque action
    // reçoit le véhicule visé, que le joueur soit dedans (menu du véhicule) ou dehors (véhicule ciblé).
    private getAdminOptions(): { level: AdminLevel; option: TargetOption }[] {
        const admin = (
            level: AdminLevel,
            group: string,
            label: string,
            action: TargetOption['action'],
            extra: Partial<TargetOption> = {}
        ) => ({
            level,
            option: { label, action, category: 'citizen' as const, group, keepOpen: true, ...extra },
        });
        const ui = { keepOpen: false };
        const noBurstTyres = () => this.adminMenuVehicleProvider.getNoBurstTyres();
        const noStall = () => this.vehicleDamageProvider.getAdminNoStall();
        const noSurfaceCalc = () => this.vehicleOffroadProvider.getNoSurfaceCalc();
        const provider = this.adminMenuVehicleProvider;

        return [
            admin('any', GROUP_ADMIN, 'Réparer', vehicle => provider.onAdminMenuVehicleRepair(vehicle)),
            admin('any', GROUP_ADMIN, 'Nettoyer', vehicle => provider.onAdminMenuVehicleClean(vehicle)),
            admin('any', GROUP_ADMIN, 'Ravitailler', vehicle => provider.onAdminMenuVehicleRefill(vehicle)),
            admin('any', GROUP_ADMIN, 'NOS', vehicle => provider.setNos(vehicle)),
            admin(
                'any',
                GROUP_ADMIN_CUSTOM,
                'Améliorer le véhicule',
                vehicle => this.bennysVehicleProvider.upgradeVehicleRemotely(vehicle, LSCustomMode.Admin),
                ui
            ),
            admin(
                'any',
                GROUP_ADMIN_CUSTOM,
                'LS Custom',
                vehicle => this.vehicleMenuProvider.handleVehicleLSCustom(LSCustomMode.Admin, vehicle),
                ui
            ),
            admin(
                'admin',
                GROUP_ADMIN_CUSTOM,
                'Configuration FBI',
                vehicle => provider.onAdminMenuVehicleSetFBIConfig(vehicle),
                ui
            ),
            admin('any', GROUP_ADMIN_CUSTOM, 'Cartographie', vehicle => provider.setMapping(vehicle)),
            admin(
                'staff',
                GROUP_ADMIN_SETTINGS,
                'Pneus increvables',
                vehicle => provider.setNoBurstTyres(!noBurstTyres(), vehicle),
                { isChecked: noBurstTyres }
            ),
            admin(
                'staff',
                GROUP_ADMIN_SETTINGS,
                'Calage désactivé',
                () => this.vehicleDamageProvider.setAdminNoStall(!noStall()),
                { isChecked: noStall }
            ),
            admin(
                'staff',
                GROUP_ADMIN_SETTINGS,
                'Surface désactivée',
                () => this.vehicleOffroadProvider.setNoSurfaceCalc(!noSurfaceCalc()),
                { isChecked: noSurfaceCalc }
            ),
            admin(
                'admin',
                GROUP_ADMIN_MANAGE,
                'Enregistrer une copie du véhicule',
                vehicle => provider.onAdminMenuVehicleSave(vehicle),
                ui
            ),
            admin(
                'staff',
                GROUP_ADMIN_MANAGE,
                'Fourrière fédérale',
                vehicle => this.vehicleGarageProvider.sendToFederalPound(vehicle),
                ui
            ),
            // Dernier de la liste, sous les sous-onglets
            admin(
                'staff',
                GROUP_ADMIN,
                'Supprimer le véhicule',
                vehicle => provider.onAdminMenuVehicleDelete(vehicle),
                ui
            ),
        ];
    }

    // Outils admin sur un véhicule ciblé depuis l'extérieur (menu contextuel uniquement, pour ne pas alourdir le
    // B-Target). Dans le véhicule, ils sont dans le menu du véhicule.
    private registerAdminTargets(): void {
        this.targetFactory.createForAllVehicle(
            this.getAdminOptions().map(({ level, option }, index) => ({
                ...option,
                order: `z${String(index).padStart(3, '0')}`,
                canInteract: async () =>
                    this.targetProvider.isCursorMode() && this.adminPermissionService.hasLevel(await this.adminPermissionService.getPermission(), level),
            })),
            ADMIN_TARGET_DISTANCE
        );
    }

    private async buildOptions(vehicle: number): Promise<TargetOption[]> {
        const ped = PlayerPedId();
        const player = this.playerService.getPlayer();

        if (!player || player.metadata.isdead || player.metadata.inlaststand || player.metadata.ishandcuffed) {
            return [];
        }

        // Les handles de véhicule peuvent être réutilisés: on oublie ce qu'on retenait sur les véhicules disparus
        for (const key of this.sticky.keys()) {
            if (!DoesEntityExist(Number(key.split(':')[0]))) this.sticky.delete(key);
        }

        const model = GetEntityModel(vehicle);
        const vehicleClass = GetVehicleClass(vehicle);
        const seatCount = GetVehicleModelNumberOfSeats(model);
        let seat: number = VehicleSeat.Driver;

        for (let i = VehicleSeat.Driver; i < seatCount - 1; i++) {
            if (GetPedInVehicleSeat(vehicle, i) === ped) {
                seat = i;
                break;
            }
        }

        const isDriver = seat === VehicleSeat.Driver;
        const isCopilot = seat === VehicleSeat.Copilot;
        const hasEngine = vehicleClass !== VehicleClass.Cycles;
        const canBelt = vehicleClass !== VehicleClass.Motorcycles && vehicleClass !== VehicleClass.Cycles;
        // Un véhicule inconnu du serveur (créé en dev, PNJ...) n'a pas d'état: on prend des valeurs par défaut
        const state: Pick<
            VehicleVolatileState,
            'open' | 'forced' | 'hasRadio' | 'indicators' | 'openWindows' | 'speedLimit' | 'neonLightsStatus'
        > = {
            open: true,
            forced: false,
            hasRadio: false,
            indicators: { left: false, right: false },
            openWindows: false,
            speedLimit: null,
            neonLightsStatus: false,
            ...(await this.vehicleStateService.getVehicleState(vehicle).catch(() => null)),
        };
        const adminPermission = await this.adminPermissionService.getPermission();
        const options: TargetOption[] = [];
        let order = 0;

        const add = (label: string, action: TargetOption['action'], extra: Partial<TargetOption> = {}) => {
            options.push({
                category: 'citizen',
                label,
                action,
                keepOpen: true,
                order: String(order++).padStart(3, '0'),
                ...extra,
            });
        };

        // Interrupteur dont l'état lu est lent à se mettre à jour: on affiche l'état demandé pendant EXPECTED_DELAY
        const toggle = (
            key: string,
            label: string,
            measured: boolean,
            apply: (next: boolean) => unknown,
            extra: Partial<TargetOption> = {}
        ) => {
            const expectedKey = `${vehicle}:${key}`;
            const current = this.getExpected(expectedKey) ?? measured;

            add(
                label,
                () => {
                    this.expected.set(expectedKey, { value: !current, until: GetGameTimer() + EXPECTED_DELAY });

                    return apply(!current);
                },
                { checked: current, ...extra }
            );
        };

        // Interrupteur dont aucune native ne donne un état fiable (phares, éclairage intérieur...): on retient la
        // dernière valeur qu'on a appliquée, l'état lu ne sert qu'à la première fois
        const stickyToggle = (
            key: string,
            label: string,
            measured: boolean,
            apply: (next: boolean) => unknown,
            extra: Partial<TargetOption> = {}
        ) => {
            const stickyKey = `${vehicle}:${key}`;
            const current = this.sticky.get(stickyKey) ?? measured;

            add(
                label,
                () => {
                    this.sticky.set(stickyKey, !current);

                    return apply(!current);
                },
                { checked: current, ...extra }
            );
        };

        // Une native qui échoue ne doit pas faire disparaître tout le menu: on isole chaque section
        const section = (name: string, build: () => void) => {
            try {
                build();
            } catch (error) {
                console.error(`[target-cursor] menu véhicule, section "${name}":`, error);
            }
        };

        // Racine
        section('racine', () => {
            if (isDriver && hasEngine) {
                toggle('engine', 'Moteur', GetIsVehicleEngineRunning(vehicle), next =>
                    this.vehicleMenuProvider.setVehicleEngine(next)
                );
            }

            if (isDriver) {
                // Même règle que le verrouillage réel: le véhicule est ouvert s'il est "open" ou "forced"
                toggle('lock', 'Véhicule verrouillé', !(state.open || state.forced), () =>
                    this.vehicleLockProvider.toggleVehicleLock()
                );
            }

            if (canBelt) {
                toggle('belt', 'Ceinture de sécurité', this.vehicleSeatbeltProvider.isSeatbeltOnForPlayer(), () =>
                    this.vehicleSeatbeltProvider.toggleVehicleSeatbelt()
                );
            }

            if (state.hasRadio && (isDriver || isCopilot)) {
                add('Radio longue portée', () => this.vehicleMenuProvider.handleVehicleRadio(), { keepOpen: false });
            }

            if (isDriver && vehicleClass === VehicleClass.Boats) {
                const anchored = IsBoatAnchoredAndFrozen(vehicle);

                add('Ancre baissée', () => this.vehicleMenuProvider.handleAnchorChange(!anchored), { checked: anchored });
            }
        });

        // Portes
        section('portes', () => {
            if (isDriver) {
                for (const [key, label] of Object.entries(DOORS)) {
                    const door = Number(key);
                    if (!DoesVehicleHaveDoor(vehicle, door)) continue;

                    toggle(
                        `door:${door}`,
                        label,
                        GetVehicleDoorAngleRatio(vehicle, door) > 0.1,
                        next => this.vehicleMenuProvider.setVehicleDoorState({ doorIndex: door, open: next }),
                        { group: GROUP_DOORS }
                    );
                }

                if (IsVehicleAConvertible(vehicle, false)) {
                    const roofState = GetConvertibleRoofState(vehicle);

                    toggle(
                        'roof',
                        'Toit ouvert',
                        roofState === 1 || roofState === 2,
                        next => (next ? LowerConvertibleRoof(vehicle, false) : RaiseConvertibleRoof(vehicle, false)),
                        { group: GROUP_DOORS }
                    );
                }

                add(
                    'Tout fermer',
                    () => {
                        for (const door of Object.keys(DOORS)) {
                            this.expected.set(`${vehicle}:door:${door}`, {
                                value: false,
                                until: GetGameTimer() + EXPECTED_DELAY,
                            });
                        }

                        SetVehicleDoorsShut(vehicle, false);
                    },
                    { group: GROUP_DOORS }
                );
            }
        });

        // Fenêtres
        section('fenêtres', () => {
            const windowsDown = this.getWindowsDown(vehicle, state.openWindows);
            const ownWindow = SEAT_WINDOW[seat];

            for (const [key, label] of Object.entries(WINDOWS)) {
                const window = Number(key);
                if (!isDriver && window !== ownWindow) continue;

                // Une fenêtre baissée n'est plus "intacte" pour le jeu: on ne masque que celles qui sont cassées
                const down = windowsDown.has(window);
                if (!down && !IsVehicleWindowIntact(vehicle, window)) continue;

                add(label, () => this.setWindow(vehicle, window, !down), { group: GROUP_WINDOWS, checked: down });
            }

            if (isDriver) {
                add('Tout baisser', () => this.setAllWindows(vehicle, true), { group: GROUP_WINDOWS });
                add('Tout monter', () => this.setAllWindows(vehicle, false), { group: GROUP_WINDOWS });
            }
        });

        // Éclairage
        section('éclairage', () => {
            if (isDriver) {
                const [, lightsOn, highBeamsOn] = GetVehicleLightsState(vehicle);

                stickyToggle('lights', 'Phares', !!lightsOn, next => SetVehicleLights(vehicle, next ? 2 : 1), {
                    group: GROUP_LIGHTS,
                });
                add(
                    'Phares automatiques',
                    () => {
                        this.sticky.delete(`${vehicle}:lights`);
                        SetVehicleLights(vehicle, 0);
                    },
                    { group: GROUP_LIGHTS }
                );
                stickyToggle('highbeams', 'Feux de route', !!highBeamsOn, next => SetVehicleFullbeam(vehicle, next), {
                    group: GROUP_LIGHTS,
                });

                // L'état des clignotants passe par le serveur: on affiche celui qu'on vient de demander en attendant
                const left = this.getExpected(`${vehicle}:indicator:left`) ?? state.indicators.left;
                const right = this.getExpected(`${vehicle}:indicator:right`) ?? state.indicators.right;

                add('Clignotant gauche', () => this.setIndicators(vehicle, !left, right), {
                    group: GROUP_LIGHTS,
                    checked: left,
                });
                add('Clignotant droit', () => this.setIndicators(vehicle, left, !right), {
                    group: GROUP_LIGHTS,
                    checked: right,
                });
                add('Warnings', () => this.setIndicators(vehicle, !(left && right), !(left && right)), {
                    group: GROUP_LIGHTS,
                    checked: left && right,
                });

                stickyToggle(
                    'interior',
                    'Éclairage intérieur',
                    !!IsVehicleInteriorLightOn(vehicle),
                    next => SetVehicleInteriorlight(vehicle, next),
                    { group: GROUP_LIGHTS }
                );

                if (this.hasNeon(vehicle)) {
                    toggle(
                        'neon',
                        'Néons',
                        !!state.neonLightsStatus,
                        next => this.vehicleMenuProvider.setNeonStatus(next),
                        { group: GROUP_LIGHTS }
                    );
                }
            }
        });

        // Sièges: impossible de changer de place avec la ceinture attachée
        section('sièges', () => {
            if (!this.vehicleSeatbeltProvider.isSeatbeltOnForPlayer()) {
                for (let i = VehicleSeat.Driver; i < seatCount - 1; i++) {
                    if (i === seat || !IsVehicleSeatFree(vehicle, i)) continue;

                    add(SEAT_LABELS[i] ?? `Place ${i + 2}`, () => SetPedIntoVehicle(ped, vehicle, i), {
                        group: GROUP_SEATS,
                    });
                }
            }
        });

        // Limiteur de vitesse
        section('limiteur de vitesse', () => {
            if (isDriver && !IsMissionTrain(vehicle)) {
                // Comme les clignotants, le limiteur passe par le serveur: on affiche la valeur demandée en attendant
                const expectedSpeed = this.expectedSpeed.get(vehicle);
                const currentSpeedLimit =
                    expectedSpeed && expectedSpeed.until >= GetGameTimer()
                        ? expectedSpeed.value
                        : state.speedLimit || null;

                const setSpeedLimit = (value: number | null, requested = value) => {
                    this.expectedSpeed.set(vehicle, { value, until: GetGameTimer() + EXPECTED_DELAY });

                    return this.vehicleMenuProvider.setVehicleSpeedLimit(requested);
                };

                for (const { label, value } of SPEED_LIMITS) {
                    add(label, () => setSpeedLimit(value), {
                        group: GROUP_SPEED,
                        checked: currentSpeedLimit === value,
                    });
                }

                add('Vitesse actuelle', () => setSpeedLimit(Math.round(GetEntitySpeed(vehicle) * 3.6), -1), {
                    group: GROUP_SPEED,
                });
                add('Personnalisé...', () => this.vehicleMenuProvider.setVehicleSpeedLimit(-2), {
                    group: GROUP_SPEED,
                    keepOpen: false,
                });
            }
        });

        // Outils admin (voir getAdminOptions)
        section('admin', () => {
            for (const { level, option } of this.getAdminOptions()) {
                if (!this.adminPermissionService.hasLevel(adminPermission, level)) continue;

                add(option.label, option.action, {
                    group: option.group,
                    keepOpen: option.keepOpen,
                    isChecked: option.isChecked,
                });
            }
        });

        // LS Custom, Pit Stop, patrouilles, gyrophare...: le menu véhicule complet
        section('plus', () => {
            if (isDriver || (isCopilot && state.hasRadio)) {
                add("Plus d'options...", () => this.vehicleMenuProvider.openMenu(), { keepOpen: false });
            }
        });

        return options;
    }

    private hasNeon(vehicle: number): boolean {
        return [0, 1, 2, 3].some(index => IsVehicleNeonLightEnabled(vehicle, index));
    }

    private getWindowsDown(vehicle: number, openWindows: boolean): Set<number> {
        for (const known of this.windowsDown.keys()) {
            if (!DoesEntityExist(known)) this.windowsDown.delete(known);
        }

        let windows = this.windowsDown.get(vehicle);

        if (!windows) {
            // Première fois qu'on voit ce véhicule: le raccourci clavier baisse les fenêtres avant
            windows = new Set(openWindows ? [0, 1] : []);
            this.windowsDown.set(vehicle, windows);
        }

        return windows;
    }

    private setWindow(vehicle: number, window: number, down: boolean): void {
        const windows = this.getWindowsDown(vehicle, false);

        if (down) {
            RollDownWindow(vehicle, window);
            windows.add(window);
        } else {
            RollUpWindow(vehicle, window);
            windows.delete(window);
        }
    }

    private setAllWindows(vehicle: number, down: boolean): void {
        for (const window of Object.keys(WINDOWS).map(Number)) {
            // Une fenêtre baissée n'est plus "intacte" pour le jeu: on ne saute que les fenêtres cassées à baisser
            if (down && !IsVehicleWindowIntact(vehicle, window)) continue;

            this.setWindow(vehicle, window, down);
        }

        // Synchronise les autres joueurs, comme le raccourci clavier
        this.vehicleStateService.updateVehicleState(vehicle, { openWindows: down }, true, true);
    }

    private setIndicators(vehicle: number, left: boolean, right: boolean): void {
        const until = GetGameTimer() + EXPECTED_DELAY;

        this.expected.set(`${vehicle}:indicator:left`, { value: left, until });
        this.expected.set(`${vehicle}:indicator:right`, { value: right, until });
        SetVehicleIndicatorLights(vehicle, 1, left);
        SetVehicleIndicatorLights(vehicle, 0, right);
        this.vehicleStateService.updateVehicleState(vehicle, { indicators: { left, right } }, true, true);
    }
}
