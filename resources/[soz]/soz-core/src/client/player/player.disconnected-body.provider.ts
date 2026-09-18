import { AnimationService } from '@public/client/animation/animation.service';
import { ClothingService } from '@public/client/clothing/clothing.service';
import { PedFactory } from '@public/client/factory/ped.factory';
import { InventoryManager } from '@public/client/inventory/inventory.manager';
import { Notifier } from '@public/client/notifier';
import { TargetFactory } from '@public/client/target/target.factory';
import { InventoryType } from '@public/shared/inventory';
import { DisconnectedBodySnapshot } from '@public/shared/player-disconnected-body';
import { Vector3, Vector4 } from '@public/shared/polyzone/vector';

import { Once, OnEvent } from '../../core/decorators/event';
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

    private appliedNetIds = new Set<number>();

    private pendingBodies = new Map<number, DisconnectedBodySnapshot>();

    private bodyCitizenIds = new Map<number, string>();

    private carriedBody = 0;

    @Once()
    public registerBodyTargets() {
        this.targetFactory.createForAllPed([
            {
                label: 'Fouiller le corps',
                icon: 'global/search',
                category: 'citizen',
                canInteract: entity => this.getBodyCitizenId(entity) !== null,
                action: (entity, entityCoords) => {
                    const citizenId = this.getBodyCitizenId(entity);
                    if (!citizenId) {
                        return;
                    }

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
                canInteract: entity =>
                    this.getBodyCitizenId(entity) !== null && !this.carriedBody && !this.playerService.isPushing(),
                action: entity => this.carryBody(entity),
            },
        ]);
    }

    private getBodyCitizenId(entity: number): string | null {
        if (!entity || !DoesEntityExist(entity) || !NetworkGetEntityIsNetworked(entity)) {
            return null;
        }

        return this.bodyCitizenIds.get(NetworkGetNetworkIdFromEntity(entity)) ?? null;
    }

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

    @OnEvent(ClientEvent.PLAYER_BODY_APPLY_APPEARANCE)
    public async onApplyAppearance(netId: number, snapshot: DisconnectedBodySnapshot) {
        if (this.appliedNetIds.has(netId) || this.pendingBodies.has(netId)) {
            return;
        }

        // Makes the body interactable as soon as it is known: the targets registered in
        // registerBodyTargets resolve it by net id, so they work before it is dressed and survive it
        // streaming in and out.
        this.bodyCitizenIds.set(netId, snapshot.citizenId);
        this.pendingBodies.set(netId, snapshot);

        let attempts = 0;
        while (!NetworkDoesEntityExistWithNetworkId(netId) && attempts < 100) {
            await wait(100);
            attempts++;
        }

        if (!NetworkDoesEntityExistWithNetworkId(netId)) {
            this.pendingBodies.delete(netId);
            return;
        }

        await this.applyBodyAppearance(netId, snapshot);
    }

    // Retries bodies this client could not dress yet: the appearance natives are ignored unless the
    // caller owns the networked ped, and ownership only comes once it is streamed in close enough.
    @Tick(TickInterval.EVERY_SECOND)
    public async retryPendingBodies() {
        if (this.pendingBodies.size === 0) {
            return;
        }

        for (const [netId, snapshot] of [...this.pendingBodies]) {
            await this.applyBodyAppearance(netId, snapshot);
        }
    }

    private async applyBodyAppearance(netId: number, snapshot: DisconnectedBodySnapshot) {
        if (!NetworkDoesEntityExistWithNetworkId(netId)) {
            return;
        }

        const pedHandle = NetToPed(netId);

        if (!NetworkHasControlOfEntity(pedHandle)) {
            NetworkRequestControlOfEntity(pedHandle);

            return;
        }

        this.pendingBodies.delete(netId);
        this.appliedNetIds.add(netId);

        await this.pedFactory.configurePed(pedHandle, {
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
            ...(snapshot.isDead
                ? { animDict: DEAD_ANIM_DICTIONARY, anim: DEAD_ANIM_NAME }
                : snapshot.animation
                  ? { animDict: snapshot.animation.dictionary, anim: snapshot.animation.name }
                  : { animDict: SLEEP_ANIM_DICTIONARY, anim: SLEEP_ANIM_NAME }),
        });

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

        SetEntityCollision(pedHandle, true, true);
        SetEntityVisible(pedHandle, true, false);
    }

    private async carryBody(entity: number) {
        for (let i = 0; i < 10; i++) {
            if (NetworkHasControlOfEntity(entity)) {
                break;
            }

            NetworkRequestControlOfEntity(entity);
            await wait(i * 100);
        }

        if (!NetworkHasControlOfEntity(entity)) {
            this.notifier.notify('Impossible de déplacer ce corps.', 'error');

            return;
        }

        const playerPed = PlayerPedId();

        FreezeEntityPosition(entity, false);
        SetEntityCollision(entity, false, true);
        SetEntityCompletelyDisableCollision(entity, true, true);
        // Same attach point/bone as the police hostage drag (police.player.provider.ts), which is built
        // for a person-shaped entity slung against the dragger's side, unlike the box-carry anim.
        AttachEntityToEntity(entity, playerPed, 11816, 0.45, 0.45, 0.0, 0.0, 0.0, 0.0, false, false, true, true, 2, true);

        this.carriedBody = entity;
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

        this.carriedBody = 0;
        this.playerService.setPushing(false);

        for (let i = 0; i < 10; i++) {
            if (NetworkHasControlOfEntity(entity)) {
                break;
            }

            NetworkRequestControlOfEntity(entity);
            await wait(i * 100);
        }

        DetachEntity(entity, false, false);
        SetEntityCompletelyDisableCollision(entity, false, true);
        SetEntityCollision(entity, true, true);
        PlaceObjectOnGroundProperly(entity);
        FreezeEntityPosition(entity, true);

        // Report the final position explicitly instead of relying on the server reading GetEntityCoords
        // off entity sync at reconnect time: sync is throttled/lags for a just-frozen entity, so that
        // read could still see the pre-move spot depending on timing.
        const netId = NetworkGetNetworkIdFromEntity(entity);
        const coords = GetEntityCoords(entity) as Vector3;
        const heading = GetEntityHeading(entity);
        TriggerServerEvent(ServerEvent.PLAYER_BODY_MOVED, netId, [coords[0], coords[1], coords[2], heading]);
    }

    @OnEvent(ClientEvent.PLAYER_BODY_REMOVE)
    public async onRemove(netId: number) {
        this.appliedNetIds.delete(netId);
        this.pendingBodies.delete(netId);
        this.bodyCitizenIds.delete(netId);

        if (!NetworkDoesEntityExistWithNetworkId(netId)) {
            return;
        }

        const pedHandle = NetToPed(netId);

        if (this.carriedBody === pedHandle) {
            DetachEntity(pedHandle, false, false);
            this.carriedBody = 0;
            this.playerService.setPushing(false);
        }

        // Backstop for the server's own DeleteEntity: it does not always take on a ped a client
        // currently owns, and only the owning client can delete it in that case.
        for (let i = 0; i < 10 && DoesEntityExist(pedHandle); i++) {
            if (NetworkHasControlOfEntity(pedHandle)) {
                DeleteEntity(pedHandle);

                return;
            }

            NetworkRequestControlOfEntity(pedHandle);
            await wait(100);
        }
    }

    @OnEvent(ClientEvent.PLAYER_BODY_TELEPORT)
    public async onTeleport(position: Vector4) {
        await this.playerPositionProvider.teleportAdminToPosition(position);
    }
}
