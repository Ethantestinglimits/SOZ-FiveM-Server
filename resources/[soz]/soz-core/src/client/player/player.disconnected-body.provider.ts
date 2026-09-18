import { AnimationService } from '@public/client/animation/animation.service';
import { ClothingService } from '@public/client/clothing/clothing.service';
import { PedFactory } from '@public/client/factory/ped.factory';
import { InventoryManager } from '@public/client/inventory/inventory.manager';
import { Notifier } from '@public/client/notifier';
import { TargetFactory } from '@public/client/target/target.factory';
import { InventoryType } from '@public/shared/inventory';
import { DisconnectedBodySnapshot } from '@public/shared/player-disconnected-body';
import { Vector3, Vector4 } from '@public/shared/polyzone/vector';

import { OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { wait } from '../../core/utils';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { PlayerPositionProvider } from './player.position.provider';
import { PlayerService } from './player.service';

const SLEEP_ANIM_DICTIONARY = 'missheist_jewel';
const SLEEP_ANIM_NAME = 'gassed_npc_customer4';
const SLEEP_MOOD = 'mood_sleeping_1';
const DEAD_ANIM_DICTIONARY = 'dead';
const DEAD_ANIM_NAME = 'dead_a';

// Local ped clones spawn within this radius of the player and despawn past it (see spawnNearbyBodies).
const SPAWN_DISTANCE = 30.0;

// Resting bodies are rendered as a non-networked ped local to each client (spawned/despawned by
// distance below), never a single shared networked entity: dressing/mood/targets are all local-only
// state anyway, so there is nothing to synchronize, no ownership to acquire, and no risk of ever
// showing the model's default look while waiting on that. A real networked ped only exists for the
// few seconds someone is actively carrying one (see carryBody).
@Provider()
export class PlayerDisconnectedBodyProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(ClothingService)
    private clothingService: ClothingService;

    @Inject(PedFactory)
    private pedFactory: PedFactory;

    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(InventoryManager)
    private inventoryManager: InventoryManager;

    @Inject(PlayerPositionProvider)
    private playerPositionProvider: PlayerPositionProvider;

    @Inject(Notifier)
    private notifier: Notifier;

    private bodies = new Map<string, DisconnectedBodySnapshot>();

    private localPeds = new Map<string, number>();

    private carriedCitizenIds = new Set<string>();

    private carrying: { citizenId: string; entity: number } | null = null;

    @Tick(TickInterval.EVERY_SECOND)
    public pushBodyStateSnapshot() {
        const player = this.playerService.getPlayer();
        if (!player) {
            return;
        }

        const ped = PlayerPedId();
        const coords = GetEntityCoords(ped) as Vector3;
        const heading = GetEntityHeading(ped);

        const runningAnimation = this.animationService.getRunningAnimation();
        const animation = runningAnimation
            ? { dictionary: runningAnimation.dictionary, name: runningAnimation.name }
            : null;

        let vehicleNetId: number | undefined;
        let vehicleSeatIndex: number | undefined;
        if (IsPedInAnyVehicle(ped, false)) {
            const vehicle = GetVehiclePedIsIn(ped, false);
            vehicleNetId = NetworkGetNetworkIdFromEntity(vehicle);
            vehicleSeatIndex = this.getVehicleSeatIndex(vehicle, ped);
        }

        const snapshot: DisconnectedBodySnapshot = {
            citizenId: player.citizenid,
            position: [coords[0], coords[1], coords[2], heading],
            model: GetEntityModel(ped),
            skin: player.skin,
            outfit: this.clothingService.getClothSet(ped),
            animation,
            isDead: !!player.metadata.isdead,
            vehicleNetId,
            vehicleSeatIndex,
        };

        TriggerServerEvent(ServerEvent.PLAYER_BODY_STATE_SYNC, snapshot);
    }

    private getVehicleSeatIndex(vehicle: number, ped: number): number {
        const maxSeats = GetVehicleMaxNumberOfPassengers(vehicle);
        for (let seat = -1; seat < maxSeats; seat++) {
            if (GetPedInVehicleSeat(vehicle, seat) === ped) {
                return seat;
            }
        }
        return -1;
    }

    @Tick(TickInterval.EVERY_SECOND)
    public async spawnNearbyBodies() {
        const playerCoords = GetEntityCoords(PlayerPedId()) as Vector3;

        for (const [citizenId, snapshot] of this.bodies) {
            const hasLocalPed = this.localPeds.has(citizenId);
            if (this.carriedCitizenIds.has(citizenId)) {
                if (hasLocalPed) {
                    this.despawnLocalPed(citizenId);
                }
                continue;
            }

            const distance = Vdist(
                playerCoords[0],
                playerCoords[1],
                playerCoords[2],
                snapshot.position[0],
                snapshot.position[1],
                snapshot.position[2]
            );

            if (distance <= SPAWN_DISTANCE && !hasLocalPed) {
                await this.spawnLocalPed(citizenId, snapshot);
            } else if (distance > SPAWN_DISTANCE && hasLocalPed) {
                this.despawnLocalPed(citizenId);
            }
        }
    }

    private async spawnLocalPed(citizenId: string, snapshot: DisconnectedBodySnapshot) {
        // Claim the slot before the model load/CreatePed await so a second tick can't double-spawn.
        this.localPeds.set(citizenId, 0);

        const pedHandle = await this.pedFactory.createPed({
            model: snapshot.model,
            coords: {
                x: snapshot.position[0],
                y: snapshot.position[1],
                z: snapshot.position[2],
                w: snapshot.position[3],
            },
            skin: snapshot.skin,
            outfit: snapshot.outfit,
            freeze: !snapshot.vehicleNetId,
            invincible: true,
            blockevents: true,
            network: false,
            ...(snapshot.isDead
                ? { animDict: DEAD_ANIM_DICTIONARY, anim: DEAD_ANIM_NAME }
                : snapshot.animation
                  ? { animDict: snapshot.animation.dictionary, anim: snapshot.animation.name }
                  : { animDict: SLEEP_ANIM_DICTIONARY, anim: SLEEP_ANIM_NAME }),
        });

        if (!pedHandle || !this.localPeds.has(citizenId)) {
            // Removed/out of range again while the model was loading.
            if (pedHandle) {
                DeleteEntity(pedHandle);
            }
            this.localPeds.delete(citizenId);
            return;
        }

        this.localPeds.set(citizenId, pedHandle);

        if (!snapshot.isDead) {
            SetFacialIdleAnimOverride(pedHandle, SLEEP_MOOD, null);
        }

        if (snapshot.vehicleNetId) {
            let vehicleAttempts = 0;
            while (!NetworkDoesEntityExistWithNetworkId(snapshot.vehicleNetId) && vehicleAttempts < 50) {
                await wait(100);
                vehicleAttempts++;
            }

            if (NetworkDoesEntityExistWithNetworkId(snapshot.vehicleNetId)) {
                const vehicle = NetToVeh(snapshot.vehicleNetId);
                SetPedIntoVehicle(pedHandle, vehicle, snapshot.vehicleSeatIndex ?? -1);
            }
        }

        this.targetFactory.createForEntity(pedHandle, [
            {
                label: 'Fouiller le corps',
                icon: 'global/search',
                category: 'citizen',
                action: (entity, entityCoords) => {
                    this.inventoryManager.openInventory(
                        InventoryType.Player,
                        `player_${citizenId}`,
                        entityCoords || (GetEntityCoords(entity) as Vector3),
                    );
                },
            },
            {
                label: 'Déplacer le corps',
                icon: 'ems/push',
                category: 'citizen',
                canInteract: () => !this.carrying,
                action: entity => this.carryBody(citizenId, entity),
            },
        ]);
    }

    private despawnLocalPed(citizenId: string) {
        const pedHandle = this.localPeds.get(citizenId);
        this.localPeds.delete(citizenId);

        if (!pedHandle || !DoesEntityExist(pedHandle)) {
            return;
        }

        this.targetFactory.removeForEntity([pedHandle]);
        DeleteEntity(pedHandle);
    }

    private async carryBody(citizenId: string, localEntity: number) {
        const snapshot = this.bodies.get(citizenId);
        if (!snapshot || this.carrying) {
            return;
        }

        const coords = GetEntityCoords(localEntity) as Vector3;
        const heading = GetEntityHeading(localEntity);

        this.despawnLocalPed(citizenId);

        // Created networked+script-host by this client, so it has network control immediately — no
        // ownership acquisition needed, unlike a server-created shared entity.
        const entity = await this.pedFactory.createPed({
            model: snapshot.model,
            coords: { x: coords[0], y: coords[1], z: coords[2], w: heading },
            skin: snapshot.skin,
            outfit: snapshot.outfit,
            invincible: true,
            network: true,
            isScriptHostPed: true,
            ...(snapshot.isDead
                ? { animDict: DEAD_ANIM_DICTIONARY, anim: DEAD_ANIM_NAME }
                : snapshot.animation
                  ? { animDict: snapshot.animation.dictionary, anim: snapshot.animation.name }
                  : { animDict: SLEEP_ANIM_DICTIONARY, anim: SLEEP_ANIM_NAME }),
        });

        if (!entity) {
            return;
        }

        const netId = NetworkGetNetworkIdFromEntity(entity);
        TriggerServerEvent(ServerEvent.PLAYER_BODY_START_CARRY, citizenId, netId);

        const playerPed = PlayerPedId();

        SetEntityCollision(entity, false, true);
        SetEntityCompletelyDisableCollision(entity, true, true);
        // Same attach point/bone as the police hostage drag (police.player.provider.ts), which is built
        // for a person-shaped entity slung against the dragger's side, unlike a box-carry anim.
        AttachEntityToEntity(entity, playerPed, 11816, 0.45, 0.45, 0.0, 0.0, 0.0, 0.0, false, false, true, true, 2, true);

        this.carrying = { citizenId, entity };
        this.playerService.setPushing(true);

        await this.animationService.playAnimation({
            base: {
                dictionary: 'anim@gangops@hostage@',
                name: 'perp_idle',
                options: {
                    repeat: true,
                    onlyUpperBody: true,
                    enablePlayerControl: true,
                },
            },
        });

        this.carrying = null;
        this.playerService.setPushing(false);

        if (!DoesEntityExist(entity)) {
            return;
        }

        DetachEntity(entity, false, false);
        SetEntityCompletelyDisableCollision(entity, false, true);
        SetEntityCollision(entity, true, true);
        PlaceObjectOnGroundProperly(entity);

        const finalCoords = GetEntityCoords(entity) as Vector3;
        const finalHeading = GetEntityHeading(entity);

        DeleteEntity(entity);

        TriggerServerEvent(ServerEvent.PLAYER_BODY_STOP_CARRY, citizenId, [
            finalCoords[0],
            finalCoords[1],
            finalCoords[2],
            finalHeading,
        ]);
    }

    @OnEvent(ClientEvent.PLAYER_BODY_SYNC)
    public onSync(snapshot: DisconnectedBodySnapshot) {
        this.bodies.set(snapshot.citizenId, snapshot);
        this.carriedCitizenIds.delete(snapshot.citizenId);

        // A stale local clone can only exist here if this body moved without going through the carry
        // flow (it shouldn't); despawn it so spawnNearbyBodies rebuilds it at the right spot.
        if (this.localPeds.has(snapshot.citizenId)) {
            this.despawnLocalPed(snapshot.citizenId);
        }
    }

    @OnEvent(ClientEvent.PLAYER_BODY_SYNC_ALL)
    public onSyncAll(snapshots: DisconnectedBodySnapshot[]) {
        for (const snapshot of snapshots) {
            this.bodies.set(snapshot.citizenId, snapshot);
        }
    }

    @OnEvent(ClientEvent.PLAYER_BODY_REMOVE)
    public onRemove(citizenId: string) {
        this.bodies.delete(citizenId);
        this.carriedCitizenIds.delete(citizenId);
        this.despawnLocalPed(citizenId);
    }

    @OnEvent(ClientEvent.PLAYER_BODY_CARRY_STATE)
    public onCarryState(citizenId: string, carrying: boolean) {
        if (carrying) {
            this.carriedCitizenIds.add(citizenId);
            this.despawnLocalPed(citizenId);
        } else {
            this.carriedCitizenIds.delete(citizenId);
        }
    }

    @OnEvent(ClientEvent.PLAYER_BODY_TELEPORT)
    public async onTeleport(position: Vector4) {
        await this.playerPositionProvider.teleportAdminToPosition(position);
    }
}
