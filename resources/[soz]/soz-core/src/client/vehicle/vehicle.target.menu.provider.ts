import { Once, OnceStep } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import {
    AdminVehicleContextMenu,
    ContextMenuEntry,
    VehicleContextMenu,
} from '@public/config/context-menu';
import { TargetOption } from '@public/shared/target';
import { LSCustomMode, VehicleClass, VehicleSeat, VehicleVolatileState } from '@public/shared/vehicle/vehicle';

import { AdminMenuVehicleProvider } from '../admin/admin.menu.vehicle.provider';
import { AdminLevel, AdminPermissionService } from '../admin/admin.permission.service';
import { BennysVehicleProvider } from '../job/bennys/bennys.vehicle.provider';
import { PlayerService } from '../player/player.service';
import { buildContextMenu } from '../target/context-menu';
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
    // reçoit le véhicule visé, que le joueur soit dedans (menu du véhicule) ou dehors (véhicule ciblé). La place, le
    // nom et le rôle de chaque entrée sont dans config/context-menu.ts (AdminVehicleContextMenu).
    private getAdminOptions(): { level: AdminLevel; option: TargetOption }[] {
        const provider = this.adminMenuVehicleProvider;
        const noBurstTyres = () => provider.getNoBurstTyres();
        const noStall = () => this.vehicleDamageProvider.getAdminNoStall();
        const noSurfaceCalc = () => this.vehicleOffroadProvider.getNoSurfaceCalc();
        // Actions qui ouvrent une interface ou suppriment le véhicule: le menu se ferme ensuite
        const ui = { keepOpen: false };

        const actions: Record<string, { action: TargetOption['action']; extra?: Partial<TargetOption> }> = {
            repair: { action: vehicle => provider.onAdminMenuVehicleRepair(vehicle) },
            clean: { action: vehicle => provider.onAdminMenuVehicleClean(vehicle) },
            refuel: { action: vehicle => provider.onAdminMenuVehicleRefill(vehicle) },
            nos: { action: vehicle => provider.setNos(vehicle) },
            upgrade: {
                action: vehicle => this.bennysVehicleProvider.upgradeVehicleRemotely(vehicle, LSCustomMode.Admin),
                extra: ui,
            },
            lsCustom: {
                action: vehicle => this.vehicleMenuProvider.handleVehicleLSCustom(LSCustomMode.Admin, vehicle),
                extra: ui,
            },
            fbi: { action: vehicle => provider.onAdminMenuVehicleSetFBIConfig(vehicle), extra: ui },
            mapping: { action: vehicle => provider.setMapping(vehicle) },
            noBurstTyres: {
                action: vehicle => provider.setNoBurstTyres(!noBurstTyres(), vehicle),
                extra: { isChecked: noBurstTyres },
            },
            noStall: {
                action: () => this.vehicleDamageProvider.setAdminNoStall(!noStall()),
                extra: { isChecked: noStall },
            },
            noSurface: {
                action: () => this.vehicleOffroadProvider.setNoSurfaceCalc(!noSurfaceCalc()),
                extra: { isChecked: noSurfaceCalc },
            },
            saveCopy: { action: vehicle => provider.onAdminMenuVehicleSave(vehicle), extra: ui },
            federalPound: { action: vehicle => this.vehicleGarageProvider.sendToFederalPound(vehicle), extra: ui },
            delete: { action: vehicle => provider.onAdminMenuVehicleDelete(vehicle), extra: ui },
        };

        const options: { level: AdminLevel; option: TargetOption }[] = [];
        const builders: Record<string, (entry: ContextMenuEntry) => void> = {};

        for (const [id, { action, extra }] of Object.entries(actions)) {
            builders[id] = entry => {
                options.push({
                    level: entry.level ?? 'any',
                    option: {
                        label: entry.label ?? entry.id,
                        group: entry.group,
                        category: 'citizen',
                        action,
                        keepOpen: true,
                        ...extra,
                    },
                });
            };
        }

        buildContextMenu('admin véhicule', AdminVehicleContextMenu, builders);

        return options;
    }

    // Outils admin sur un véhicule ciblé depuis l'extérieur (menu contextuel uniquement, pour ne pas alourdir le
    // B-Target). Dans le véhicule, ils sont dans le menu du véhicule.
    private registerAdminTargets(): void {
        this.targetFactory.createForAllVehicle(
            this.getAdminOptions().map(({ level, option }, index) => ({
                ...option,
                order: `z${String(index).padStart(3, '0')}`,
                // Les outils admin restent disponibles pendant les événements (WhatIf, jeu du vampire...), qui
                // masquent les cibles sans événement
                event: 'all',
                canInteract: async () =>
                    this.targetProvider.isCursorMode() &&
                    this.adminPermissionService.hasLevel(await this.adminPermissionService.getPermission(), level),
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

        const add = (entry: ContextMenuEntry, action: TargetOption['action'], extra: Partial<TargetOption> = {}) => {
            options.push({
                category: 'citizen',
                label: entry.label ?? entry.id,
                group: entry.group,
                action,
                keepOpen: true,
                order: String(order++).padStart(3, '0'),
                ...extra,
            });
        };

        // Option générée par un bloc (une par porte, par fenêtre...): même sous-menu que le bloc, libellé propre
        const named = (entry: ContextMenuEntry, label: string): ContextMenuEntry => ({ ...entry, label });

        // Interrupteur dont l'état lu est lent à se mettre à jour: on affiche l'état demandé pendant EXPECTED_DELAY
        const toggle = (
            entry: ContextMenuEntry,
            key: string,
            measured: boolean,
            apply: (next: boolean) => unknown,
            extra: Partial<TargetOption> = {}
        ) => {
            const expectedKey = `${vehicle}:${key}`;
            const current = this.getExpected(expectedKey) ?? measured;

            add(
                entry,
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
            entry: ContextMenuEntry,
            key: string,
            measured: boolean,
            apply: (next: boolean) => unknown,
            extra: Partial<TargetOption> = {}
        ) => {
            const stickyKey = `${vehicle}:${key}`;
            const current = this.sticky.get(stickyKey) ?? measured;

            add(
                entry,
                () => {
                    this.sticky.set(stickyKey, !current);

                    return apply(!current);
                },
                { checked: current, ...extra }
            );
        };

        // L'état des clignotants passe par le serveur: on affiche celui qu'on vient de demander en attendant
        const indicators = () => ({
            left: this.getExpected(`${vehicle}:indicator:left`) ?? state.indicators.left,
            right: this.getExpected(`${vehicle}:indicator:right`) ?? state.indicators.right,
        });

        // Comme les clignotants, le limiteur passe par le serveur: on affiche la valeur demandée en attendant
        const canLimitSpeed = isDriver && !IsMissionTrain(vehicle);
        const currentSpeedLimit = () => {
            const expectedSpeed = this.expectedSpeed.get(vehicle);

            return expectedSpeed && expectedSpeed.until >= GetGameTimer()
                ? expectedSpeed.value
                : state.speedLimit || null;
        };
        const setSpeedLimit = (value: number | null, requested = value) => {
            this.expectedSpeed.set(vehicle, { value, until: GetGameTimer() + EXPECTED_DELAY });

            return this.vehicleMenuProvider.setVehicleSpeedLimit(requested);
        };

        // Les actions, par id: leur place, leur nom et leur sous-menu sont dans config/context-menu.ts
        // (VehicleContextMenu). Un bloc génère plusieurs options (une par porte, par fenêtre...).
        const builders: Record<string, (entry: ContextMenuEntry) => void> = {
            engine: entry => {
                if (isDriver && hasEngine) {
                    toggle(entry, 'engine', GetIsVehicleEngineRunning(vehicle), next =>
                        this.vehicleMenuProvider.setVehicleEngine(next)
                    );
                }
            },

            lock: entry => {
                // Même règle que le verrouillage réel: le véhicule est ouvert s'il est "open" ou "forced"
                if (isDriver) {
                    toggle(entry, 'lock', !(state.open || state.forced), () =>
                        this.vehicleLockProvider.toggleVehicleLock()
                    );
                }
            },

            belt: entry => {
                if (canBelt) {
                    toggle(entry, 'belt', this.vehicleSeatbeltProvider.isSeatbeltOnForPlayer(), () =>
                        this.vehicleSeatbeltProvider.toggleVehicleSeatbelt()
                    );
                }
            },

            radio: entry => {
                if (state.hasRadio && (isDriver || isCopilot)) {
                    add(entry, () => this.vehicleMenuProvider.handleVehicleRadio(), { keepOpen: false });
                }
            },

            anchor: entry => {
                if (isDriver && vehicleClass === VehicleClass.Boats) {
                    const anchored = IsBoatAnchoredAndFrozen(vehicle);

                    add(entry, () => this.vehicleMenuProvider.handleAnchorChange(!anchored), { checked: anchored });
                }
            },

            doors: entry => {
                if (!isDriver) return;

                for (const [key, label] of Object.entries(DOORS)) {
                    const door = Number(key);
                    if (!DoesVehicleHaveDoor(vehicle, door)) continue;

                    toggle(named(entry, label), `door:${door}`, GetVehicleDoorAngleRatio(vehicle, door) > 0.1, next =>
                        this.vehicleMenuProvider.setVehicleDoorState({ doorIndex: door, open: next })
                    );
                }
            },

            roof: entry => {
                if (!isDriver || !IsVehicleAConvertible(vehicle, false)) return;

                const roofState = GetConvertibleRoofState(vehicle);

                toggle(entry, 'roof', roofState === 1 || roofState === 2, next =>
                    next ? LowerConvertibleRoof(vehicle, false) : RaiseConvertibleRoof(vehicle, false)
                );
            },

            closeDoors: entry => {
                if (!isDriver) return;

                add(entry, () => {
                    for (const door of Object.keys(DOORS)) {
                        this.expected.set(`${vehicle}:door:${door}`, {
                            value: false,
                            until: GetGameTimer() + EXPECTED_DELAY,
                        });
                    }

                    SetVehicleDoorsShut(vehicle, false);
                });
            },

            windows: entry => {
                const windowsDown = this.getWindowsDown(vehicle, state.openWindows);
                const ownWindow = SEAT_WINDOW[seat];

                for (const [key, label] of Object.entries(WINDOWS)) {
                    const window = Number(key);
                    if (!isDriver && window !== ownWindow) continue;

                    // Une fenêtre baissée n'est plus "intacte" pour le jeu: on ne masque que celles qui sont cassées
                    const down = windowsDown.has(window);
                    if (!down && !IsVehicleWindowIntact(vehicle, window)) continue;

                    add(named(entry, label), () => this.setWindow(vehicle, window, !down), { checked: down });
                }
            },

            windowsDown: entry => {
                if (isDriver) add(entry, () => this.setAllWindows(vehicle, true));
            },

            windowsUp: entry => {
                if (isDriver) add(entry, () => this.setAllWindows(vehicle, false));
            },

            headlights: entry => {
                if (!isDriver) return;

                const [, lightsOn] = GetVehicleLightsState(vehicle);

                stickyToggle(entry, 'lights', !!lightsOn, next => SetVehicleLights(vehicle, next ? 2 : 1));
            },

            autoLights: entry => {
                if (!isDriver) return;

                add(entry, () => {
                    this.sticky.delete(`${vehicle}:lights`);
                    SetVehicleLights(vehicle, 0);
                });
            },

            highbeams: entry => {
                if (!isDriver) return;

                const [, , highBeamsOn] = GetVehicleLightsState(vehicle);

                stickyToggle(entry, 'highbeams', !!highBeamsOn, next => SetVehicleFullbeam(vehicle, next));
            },

            indicatorLeft: entry => {
                if (!isDriver) return;

                const { left, right } = indicators();

                add(entry, () => this.setIndicators(vehicle, !left, right), { checked: left });
            },

            indicatorRight: entry => {
                if (!isDriver) return;

                const { left, right } = indicators();

                add(entry, () => this.setIndicators(vehicle, left, !right), { checked: right });
            },

            warnings: entry => {
                if (!isDriver) return;

                const { left, right } = indicators();

                add(entry, () => this.setIndicators(vehicle, !(left && right), !(left && right)), {
                    checked: left && right,
                });
            },

            interiorLight: entry => {
                if (!isDriver) return;

                stickyToggle(entry, 'interior', !!IsVehicleInteriorLightOn(vehicle), next =>
                    SetVehicleInteriorlight(vehicle, next)
                );
            },

            neon: entry => {
                if (isDriver && this.hasNeon(vehicle)) {
                    toggle(entry, 'neon', !!state.neonLightsStatus, next =>
                        this.vehicleMenuProvider.setNeonStatus(next)
                    );
                }
            },

            // Impossible de changer de place avec la ceinture attachée
            seats: entry => {
                if (this.vehicleSeatbeltProvider.isSeatbeltOnForPlayer()) return;

                for (let i = VehicleSeat.Driver; i < seatCount - 1; i++) {
                    if (i === seat || !IsVehicleSeatFree(vehicle, i)) continue;

                    add(named(entry, SEAT_LABELS[i] ?? `Place ${i + 2}`), () => SetPedIntoVehicle(ped, vehicle, i));
                }
            },

            speedLimit: entry => {
                if (!canLimitSpeed) return;

                const current = currentSpeedLimit();

                for (const { label, value } of SPEED_LIMITS) {
                    add(named(entry, label), () => setSpeedLimit(value), { checked: current === value });
                }
            },

            speedLimitCurrent: entry => {
                if (canLimitSpeed) add(entry, () => setSpeedLimit(Math.round(GetEntitySpeed(vehicle) * 3.6), -1));
            },

            speedLimitCustom: entry => {
                if (canLimitSpeed) {
                    add(entry, () => this.vehicleMenuProvider.setVehicleSpeedLimit(-2), { keepOpen: false });
                }
            },

            // Outils admin (voir getAdminOptions et AdminVehicleContextMenu), à cet emplacement de la liste
            admin: () => {
                for (const { level, option } of this.getAdminOptions()) {
                    if (!this.adminPermissionService.hasLevel(adminPermission, level)) continue;

                    add({ id: option.label, label: option.label, group: option.group }, option.action, {
                        keepOpen: option.keepOpen,
                        isChecked: option.isChecked,
                    });
                }
            },

            // LS Custom, Pit Stop, patrouilles, gyrophare...: le menu véhicule complet
            more: entry => {
                if (isDriver || (isCopilot && state.hasRadio)) {
                    add(entry, () => this.vehicleMenuProvider.openMenu(), { keepOpen: false });
                }
            },
        };

        buildContextMenu('véhicule', VehicleContextMenu, builders);

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
