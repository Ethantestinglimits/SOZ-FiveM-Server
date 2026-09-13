import { Once, OnceStep, OnEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { emitRpc } from '@core/rpc';
import { wait } from '@core/utils';
import { AnimationRunner } from '@public/client/animation/animation.factory';
import { AnimationService } from '@public/client/animation/animation.service';
import { TargetFactory } from '@public/client/target/target.factory';

import { ClientEvent, ServerEvent } from '../../shared/event';
import { Vector3 } from '../../shared/polyzone/vector';
import { RpcServerEvent } from '../../shared/rpc';
import { computeCrashDamage, computeGStrength } from '../../shared/vehicle/crash';
import { VehicleClass } from '../../shared/vehicle/vehicle';
import { Notifier } from '../notifier';
import { PlayerService } from '../player/player.service';
import { ProgressService } from '../progress.service';
import { VehicleLockProvider } from './vehicle.lock.provider';
import { getVehicleSpeedKmh, ragdollWithVelocity } from './vehicle.physics';
import { VehicleService } from './vehicle.service';

const unarmed = GetHashKey('WEAPON_UNARMED');

const TRUNK_ANIMATION = {
    dictionary: 'mp_sleep',
    name: 'sleep_loop',
};

const TRUNK_HIDE_LABEL_DURATION = 24 * 60 * 60 * 1000;

// Above this speed, the trunk is considered locked shut: nobody can get in or out.
const TRUNK_MAX_SPEED = 50;

// Above this speed, someone leaving the trunk is thrown out ragdolled, keeping the vehicle's momentum,
// instead of calmly stepping out.
const TRUNK_RAGDOLL_EXIT_SPEED = 10;

// A hidden occupant has no collision, so the game never damages them when the vehicle crashes.
// They have no seatbelt and nothing to brace against back there, so this triggers earlier and hits
// harder than the "seatbelt on" crash damage in vehicle.seatbelt.provider.ts.
const TRUNK_MONITOR_TICK_INTERVAL_SECONDS = 0.1;
const TRUNK_CRASH_DAMAGE_G_THRESHOLD = 4.0;
const TRUNK_CRASH_DAMAGE_FACTOR = 12;

// How often (in monitor ticks) to check whether the vehicle disappeared and refresh its last known position.
const TRUNK_VEHICLE_EXISTENCE_CHECK_EVERY_TICKS = Math.round(1 / TRUNK_MONITOR_TICK_INTERVAL_SECONDS);

// Regular passenger cars only - no bikes, no work/utility vehicles (offroad, vans, trucks, ...), no boats/planes/trains.
const TRUNK_HIDE_ALLOWED_CLASSES = [
    VehicleClass.Compacts,
    VehicleClass.Sedans,
    VehicleClass.SUVs,
    VehicleClass.Coupes,
    VehicleClass.Muscle,
    VehicleClass.Sportsclassics,
    VehicleClass.Sports,
    VehicleClass.Super,
    VehicleClass.Emergency,
];

@Provider()
export class VehicleTrunkHideProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(ProgressService)
    private progressService: ProgressService;

    @Inject(Notifier)
    private notifier: Notifier;

    @Inject(VehicleService)
    private vehicleService: VehicleService;

    @Inject(VehicleLockProvider)
    private vehicleLockProvider: VehicleLockProvider;

    private isHidden = false;
    private isBlackedOut = false;
    private isExiting = false;
    private isAttemptingExit = false;
    private hiddenVehicle: number | null = null;
    private hiddenVehicleNetworkId: number | null = null;
    private lastKnownVehiclePosition: Vector3 | null = null;
    private lastMonitoredVehicleVelocity: Vector3 | null = null;
    private lastMonitoredVehicleHealth: number | null = null;
    private monitorTickCount = 0;
    private animationRunner: AnimationRunner | null = null;
    private occupiedTrunks = new Set<number>();

    @Once(OnceStep.Start)
    public async initOccupiedTrunks() {
        const occupied = await emitRpc<number[]>(RpcServerEvent.VEHICLE_TRUNK_GET_OCCUPIED);

        this.occupiedTrunks = new Set(occupied);
    }

    @OnEvent(ClientEvent.VEHICLE_TRUNK_OCCUPIED_LIST)
    public onOccupiedList(vehicles: number[]) {
        this.occupiedTrunks = new Set(vehicles);
    }

    private isNormalCar(entity: number): boolean {
        return TRUNK_HIDE_ALLOWED_CLASSES.includes(GetVehicleClass(entity));
    }

    private isTooFastForTrunk(entity: number): boolean {
        return getVehicleSpeedKmh(entity) > TRUNK_MAX_SPEED;
    }

    private isAboveRagdollExitSpeed(entity: number): boolean {
        return getVehicleSpeedKmh(entity) > TRUNK_RAGDOLL_EXIT_SPEED;
    }

    // FiveM can recycle an entity handle after the original entity is gone, so DoesEntityExist alone
    // isn't enough once we've been holding onto `vehicle` across awaits - cross-check the network id
    // captured at entry to make sure it's still the same vehicle before trusting its position/velocity.
    private isHiddenVehicleStillValid(vehicle: number): boolean {
        return (
            DoesEntityExist(vehicle) &&
            this.hiddenVehicleNetworkId !== null &&
            NetworkGetNetworkIdFromEntity(vehicle) === this.hiddenVehicleNetworkId
        );
    }

    // Shared eligibility rules for every trunk interaction target; each target adds its own
    // occupancy/state-specific clause on top of this.
    private canAccessTrunk(entity: number): boolean {
        return (
            this.vehicleService.checkBackOfVehicle(entity) &&
            this.vehicleLockProvider.isVehOpen(entity) &&
            this.isNormalCar(entity) &&
            !this.isTooFastForTrunk(entity)
        );
    }

    @Once()
    public onInit() {
        this.targetFactory.createForAllVehicle([
            {
                label: 'Monter dans le coffre',
                icon: 'vehicle/car',
                category: 'citizen',
                canInteract: entity => {
                    if (
                        this.isHidden ||
                        !this.playerService.canDoAction() ||
                        this.progressService.isDoingAction() ||
                        !this.canAccessTrunk(entity) ||
                        this.occupiedTrunks.has(NetworkGetNetworkIdFromEntity(entity))
                    ) {
                        return false;
                    }

                    const ped = PlayerPedId();

                    return IsPedOnFoot(ped) && !IsPedInAnyVehicle(ped, false);
                },
                action: entity => {
                    this.enterTrunk(entity);
                },
            },
            {
                label: 'Mettre dans le coffre',
                icon: 'vehicle/car',
                category: 'criminal',
                canInteract: entity => {
                    if (
                        this.isHidden ||
                        !this.canAccessTrunk(entity) ||
                        this.occupiedTrunks.has(NetworkGetNetworkIdFromEntity(entity))
                    ) {
                        return false;
                    }

                    const state = this.playerService.getState();

                    return state.isEscorting && state.escorting !== null;
                },
                action: entity => {
                    const state = this.playerService.getState();

                    if (!state.escorting) {
                        return;
                    }

                    const vehicleNetworkId = NetworkGetNetworkIdFromEntity(entity);
                    TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_PUT_PLAYER, state.escorting, vehicleNetworkId);
                },
            },
            {
                label: "Sortir quelqu'un du coffre",
                icon: 'vehicle/car',
                category: 'citizen',
                canInteract: entity =>
                    !this.isHidden &&
                    this.canAccessTrunk(entity) &&
                    this.occupiedTrunks.has(NetworkGetNetworkIdFromEntity(entity)),
                action: entity => {
                    const vehicleNetworkId = NetworkGetNetworkIdFromEntity(entity);
                    TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_EXTRACT_PLAYER, vehicleNetworkId);
                },
            },
        ]);
    }

    private async enterTrunk(vehicle: number) {
        if (this.isHidden || !DoesEntityExist(vehicle)) {
            return;
        }

        // Applies to every entry path, including being forced in by an escort - the UI-level
        // canInteract check only ever covers the person voluntarily clicking the target themselves.
        if (this.isTooFastForTrunk(vehicle)) {
            this.notifier.notify('Le coffre est verrouillé, le véhicule roule trop vite.', 'error');

            return;
        }

        this.isHidden = true;

        const vehicleNetworkId = NetworkGetNetworkIdFromEntity(vehicle);
        const claimed = await emitRpc<boolean>(RpcServerEvent.VEHICLE_TRUNK_CLAIM, vehicleNetworkId);

        if (!claimed) {
            this.isHidden = false;
            this.notifier.notify('Ce coffre est déjà occupé.', 'error');

            return;
        }

        if (!this.isHidden) {
            // Something else (death, forced exit, ...) already resolved a hide attempt while we were
            // waiting on the claim RPC - release what we just got granted instead of entering anyway.
            TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_RELEASE, vehicleNetworkId);

            return;
        }

        this.hiddenVehicle = vehicle;
        this.hiddenVehicleNetworkId = vehicleNetworkId;
        this.lastKnownVehiclePosition = GetEntityCoords(vehicle, false) as Vector3;

        const ped = PlayerPedId();

        FreezeEntityPosition(ped, true);
        TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, true);

        this.animationRunner = this.animationService.playAnimation(
            {
                base: {
                    dictionary: TRUNK_ANIMATION.dictionary,
                    name: TRUNK_ANIMATION.name,
                    blendInSpeed: 2.0,
                    blendOutSpeed: 2.0,
                    options: {
                        repeat: true,
                        freezeLastFrame: true,
                    },
                },
            },
            { ped }
        );

        await wait(1500);

        TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, false);

        SetEntityVisible(ped, false, false);
        SetEntityCollision(ped, false, false);
        FreezeEntityPosition(ped, false);

        const boneIndex = GetEntityBoneIndexByName(vehicle, 'boot');
        AttachEntityToEntity(
            ped,
            vehicle,
            boneIndex,
            0.0,
            -0.3,
            -0.1,
            0.0,
            0.0,
            0.0,
            false,
            false,
            false,
            false,
            2,
            true
        );

        this.isBlackedOut = true;

        do {
            await this.progressService.progress(
                'vehicleTrunkHide',
                'Vous êtes dans un coffre...',
                TRUNK_HIDE_LABEL_DURATION,
                {},
                {
                    canCancel: true,
                    forceCancelHint: true,
                    useWhileDead: true,
                    allowExistingAnimation: true,
                    no_inv_busy: true,
                    hideBar: true,
                }
            );

            await this.exitTrunk();
            // Someone else (death, forced extraction, the vehicle disappearing) may already be mid-exit
            // by the time this resolves - don't restart the hide progress/UI on top of that.
        } while (this.isHidden && !this.isExiting);
    }

    // waitForSafeSpeed: keep retrying silently until the vehicle slows down instead of giving up.
    // Used for exits the player did not choose to attempt right now (forced extraction, death) -
    // a voluntary cancel should not be honoured automatically later on, once the car happens to slow down.
    private async exitTrunk(waitForSafeSpeed = false): Promise<boolean> {
        if (!this.isHidden || this.isExiting || this.isAttemptingExit) {
            return false;
        }

        this.isAttemptingExit = true;

        const hiddenVehicle = this.hiddenVehicle;

        if (hiddenVehicle && this.isHiddenVehicleStillValid(hiddenVehicle) && this.isTooFastForTrunk(hiddenVehicle)) {
            this.notifier.notify('Le coffre est verrouillé, le véhicule roule trop vite.', 'error');

            if (!waitForSafeSpeed) {
                this.isAttemptingExit = false;

                return false;
            }

            while (
                this.isHidden &&
                this.isHiddenVehicleStillValid(hiddenVehicle) &&
                this.isTooFastForTrunk(hiddenVehicle)
            ) {
                await wait(500);
            }
        }

        this.isAttemptingExit = false;

        if (!this.isHidden || this.isExiting) {
            return false;
        }

        this.isExiting = true;
        this.isBlackedOut = false;
        this.progressService.cancel();

        const ped = PlayerPedId();
        const vehicle = this.hiddenVehicle;
        const vehicleExists = Boolean(vehicle && this.isHiddenVehicleStillValid(vehicle));
        // Always use the network id captured on entry: once the vehicle is gone (stored in a garage,
        // despawned, ...) the entity handle no longer resolves to one, but the server still needs it
        // to release its claim on the trunk.
        const vehicleNetworkId = this.hiddenVehicleNetworkId;

        if (vehicleNetworkId) {
            if (vehicleExists) {
                TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, true);
            }
            TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_RELEASE, vehicleNetworkId);
        }

        if (this.animationRunner) {
            this.animationRunner.cancel();
            this.animationRunner = null;
        }

        if (IsEntityAttached(ped)) {
            DetachEntity(ped, true, false);
        }

        if (GetSelectedPedWeapon(ped) !== unarmed) {
            SetCurrentPedWeapon(ped, unarmed, true);
        }

        let shouldRagdoll = false;
        let vehicleVelocity: Vector3 | null = null;

        if (vehicleExists) {
            const [exitX, exitY, exitZ] = GetOffsetFromEntityInWorldCoords(vehicle, 0.0, -3.0, 0.0) as Vector3;
            SetEntityCoords(ped, exitX, exitY, exitZ, false, false, false, true);
            SetEntityHeading(ped, GetEntityHeading(vehicle));

            if (this.isAboveRagdollExitSpeed(vehicle)) {
                shouldRagdoll = true;
                vehicleVelocity = GetEntityVelocity(vehicle) as Vector3;
            }
        } else if (this.lastKnownVehiclePosition) {
            // The vehicle disappeared (stored in a garage, despawned, ...) while someone was hidden inside -
            // fall back to where it was last seen instead of leaving them stuck wherever the attachment broke.
            const [x, y, z] = this.lastKnownVehiclePosition;
            SetEntityCoords(ped, x, y, z + 1.0, false, false, false, true);
        }

        SetEntityVisible(ped, true, false);
        SetEntityCollision(ped, true, true);

        if (shouldRagdoll && vehicleVelocity) {
            await wait(0);

            ragdollWithVelocity(ped, vehicleVelocity);
        } else {
            FreezeEntityPosition(ped, true);

            await wait(500);

            FreezeEntityPosition(ped, false);
        }

        if (vehicleNetworkId) {
            await wait(1000);
            TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, false);
        }

        this.isHidden = false;
        this.isExiting = false;
        this.hiddenVehicle = null;
        this.hiddenVehicleNetworkId = null;
        this.lastKnownVehiclePosition = null;

        return true;
    }

    @Tick(TRUNK_MONITOR_TICK_INTERVAL_SECONDS * 1000)
    private async trunkMonitorLoop() {
        if (!this.isHidden || !this.hiddenVehicle) {
            this.lastMonitoredVehicleVelocity = null;
            this.lastMonitoredVehicleHealth = null;
            this.monitorTickCount = 0;

            return;
        }

        const vehicle = this.hiddenVehicle;

        if (!this.isHiddenVehicleStillValid(vehicle)) {
            // Only warn/act once per disappearance - exitTrunk() is already running for a few hundred
            // ms to a couple seconds, and this tick fires every 100ms in the meantime.
            if (!this.isExiting && !this.isAttemptingExit) {
                this.notifier.notify('Le véhicule a disparu, vous êtes éjecté du coffre.', 'error');
            }

            await this.exitTrunk(true);

            return;
        }

        this.monitorTickCount++;

        if (this.monitorTickCount >= TRUNK_VEHICLE_EXISTENCE_CHECK_EVERY_TICKS) {
            this.monitorTickCount = 0;
            this.lastKnownVehiclePosition = GetEntityCoords(vehicle, false) as Vector3;
        }

        if (!NetworkGetEntityIsNetworked(vehicle) || !NetworkHasControlOfEntity(vehicle)) {
            // Ownership migration can produce a large interpolation jump that reads as a crash -
            // mirrors vehicle.seatbelt.provider.ts's own ownership guard.
            this.lastMonitoredVehicleVelocity = null;
            this.lastMonitoredVehicleHealth = null;

            return;
        }

        this.checkCrashDamage(vehicle);
    }

    // A hidden occupant has no collision, so the game never damages them when the vehicle crashes -
    // mirrors vehicle.seatbelt.provider.ts's crash detection, gated the same way on an actual drop in
    // vehicle health so hard braking/bumps/jumps alone don't hurt them.
    private checkCrashDamage(vehicle: number) {
        const velocity = GetEntityVelocity(vehicle) as Vector3;
        const health = GetEntityHealth(vehicle);

        if (!this.lastMonitoredVehicleVelocity || this.lastMonitoredVehicleHealth === null) {
            this.lastMonitoredVehicleVelocity = velocity;
            this.lastMonitoredVehicleHealth = health;

            return;
        }

        const gStrength = computeGStrength(
            this.lastMonitoredVehicleVelocity,
            velocity,
            TRUNK_MONITOR_TICK_INTERVAL_SECONDS
        );
        const vehicleDamaged = this.lastMonitoredVehicleHealth !== health;

        this.lastMonitoredVehicleVelocity = velocity;
        this.lastMonitoredVehicleHealth = health;

        if (!vehicleDamaged || gStrength <= TRUNK_CRASH_DAMAGE_G_THRESHOLD) {
            return;
        }

        const damage = computeCrashDamage(
            gStrength,
            TRUNK_CRASH_DAMAGE_G_THRESHOLD,
            velocity,
            TRUNK_CRASH_DAMAGE_FACTOR
        );

        if (damage <= 0 || this.playerService.getPlayer().metadata.godmode) {
            return;
        }

        const ped = PlayerPedId();
        SetEntityHealth(ped, Math.max(0, Math.round(GetEntityHealth(ped) - damage)));
    }

    @Tick()
    private async trunkOverlayLoop() {
        if (!this.isBlackedOut) {
            return;
        }

        DrawRect(0.5, 0.5, 1.0, 1.0, 0, 0, 0, 204);
    }

    @OnEvent(ClientEvent.VEHICLE_TRUNK_FORCE_EXIT)
    public async onForceExit() {
        await this.exitTrunk(true);
    }

    @OnEvent(ClientEvent.PLAYER_ON_DEATH)
    public async onPlayerDeath() {
        if (this.isHidden) {
            await this.exitTrunk(true);
        }
    }

    @OnEvent(ClientEvent.VEHICLE_TRUNK_FORCE_ENTER)
    public async onForceEnter(vehicleNetworkId: number) {
        if (!NetworkDoesNetworkIdExist(vehicleNetworkId)) {
            return;
        }

        const vehicle = NetworkGetEntityFromNetworkId(vehicleNetworkId);

        if (!DoesEntityExist(vehicle)) {
            return;
        }

        await this.enterTrunk(vehicle);
    }
}
