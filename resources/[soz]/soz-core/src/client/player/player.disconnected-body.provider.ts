import { AnimationService } from '@public/client/animation/animation.service';
import { ClothingService } from '@public/client/clothing/clothing.service';
import { PedFactory } from '@public/client/factory/ped.factory';
import { InventoryManager } from '@public/client/inventory/inventory.manager';
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

const SLEEP_SCENARIO = 'WORLD_HUMAN_BUM_SLUMPED';
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
        let attempts = 0;
        while (!NetworkDoesEntityExistWithNetworkId(netId) && attempts < 100) {
            await wait(100);
            attempts++;
        }

        if (!NetworkDoesEntityExistWithNetworkId(netId)) {
            return;
        }

        const pedHandle = NetToPed(netId);

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
                  : { scenario: SLEEP_SCENARIO }),
        });

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
                        `player_${snapshot.citizenId}`,
                        entityCoords || (GetEntityCoords(entity) as Vector3),
                    );
                },
            },
        ]);
    }

    @OnEvent(ClientEvent.PLAYER_BODY_TELEPORT)
    public async onTeleport(position: Vector4) {
        await this.playerPositionProvider.teleportAdminToPosition(position);
    }
}
