import { On, OnEvent } from '@public/core/decorators/event';
import { Inject } from '@public/core/decorators/injectable';
import { Provider } from '@public/core/decorators/provider';
import { Rpc } from '@public/core/decorators/rpc';
import { PlayerService } from '@public/server/player/player.service';
import { PlayerStateService } from '@public/server/player/player.state.service';
import { ClientEvent, ServerEvent } from '@public/shared/event';
import { RpcServerEvent } from '@public/shared/rpc';

@Provider()
export class VehicleTrunkHideProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(PlayerStateService)
    private playerStateService: PlayerStateService;

    private occupiedTrunks = new Map<number, number>();

    private broadcastOccupiedTrunks() {
        TriggerClientEvent(ClientEvent.VEHICLE_TRUNK_OCCUPIED_LIST, -1, [...this.occupiedTrunks.keys()]);
    }

    @Rpc(RpcServerEvent.VEHICLE_TRUNK_GET_OCCUPIED)
    public getOccupiedTrunks(): number[] {
        return [...this.occupiedTrunks.keys()];
    }

    @Rpc(RpcServerEvent.VEHICLE_TRUNK_CLAIM)
    public async claimTrunk(source: number, vehicleNetworkId: number): Promise<boolean> {
        if (this.occupiedTrunks.has(vehicleNetworkId)) {
            return false;
        }

        this.occupiedTrunks.set(vehicleNetworkId, source);
        this.broadcastOccupiedTrunks();

        return true;
    }

    @OnEvent(ServerEvent.VEHICLE_TRUNK_RELEASE)
    public async onTrunkRelease(source: number, vehicleNetworkId: number) {
        if (this.occupiedTrunks.get(vehicleNetworkId) === source) {
            this.occupiedTrunks.delete(vehicleNetworkId);
            this.broadcastOccupiedTrunks();
        }
    }

    @On('playerDropped')
    public onPlayerDropped(source: number) {
        let changed = false;

        for (const [vehicleNetworkId, occupant] of this.occupiedTrunks) {
            if (occupant === source) {
                this.occupiedTrunks.delete(vehicleNetworkId);
                changed = true;
            }
        }

        if (changed) {
            this.broadcastOccupiedTrunks();
        }
    }

    private relayTrunkState(vehicleNetworkId: number, state: boolean) {
        const entityId = NetworkGetEntityFromNetworkId(vehicleNetworkId);

        if (!entityId) {
            return;
        }

        const owner = NetworkGetEntityOwner(entityId);

        if (!owner) {
            return;
        }

        TriggerClientEvent(ClientEvent.VEHICLE_SET_TRUNK_STATE, owner, vehicleNetworkId, state);
    }

    @OnEvent(ServerEvent.VEHICLE_TRUNK_ENTER)
    public async onTrunkEnter(source: number, vehicleNetworkId: number, state: boolean) {
        this.relayTrunkState(vehicleNetworkId, state);
    }

    @OnEvent(ServerEvent.VEHICLE_TRUNK_PUT_PLAYER)
    public async onTrunkPutPlayer(source: number, targetId: number, vehicleNetworkId: number) {
        const player = this.playerService.getPlayer(source);
        const target = this.playerService.getPlayer(targetId);

        if (!player || !target || player === target) {
            return;
        }

        const playerState = this.playerStateService.getClientState(source);

        if (!playerState.isEscorting || playerState.escorting !== target.source) {
            return;
        }

        this.playerStateService.setClientState(target.source, { isEscorted: false });
        this.playerStateService.setClientState(player.source, { isEscorting: false, escorting: null });
        TriggerClientEvent(ClientEvent.REMOVE_ESCORTED, target.source);

        TriggerClientEvent(ClientEvent.VEHICLE_TRUNK_FORCE_ENTER, target.source, vehicleNetworkId);
    }

    @OnEvent(ServerEvent.VEHICLE_TRUNK_EXTRACT_PLAYER)
    public async onTrunkExtractPlayer(source: number, vehicleNetworkId: number) {
        const occupant = this.occupiedTrunks.get(vehicleNetworkId);

        if (!occupant) {
            TriggerClientEvent(ClientEvent.NOTIFICATION_DRAW, source, 'Ce coffre est vide.', 'error');

            return;
        }

        TriggerClientEvent(ClientEvent.VEHICLE_TRUNK_FORCE_EXIT, occupant);
    }
}
