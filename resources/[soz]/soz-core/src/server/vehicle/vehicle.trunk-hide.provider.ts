import { OnEvent } from '@public/core/decorators/event';
import { Inject } from '@public/core/decorators/injectable';
import { Provider } from '@public/core/decorators/provider';
import { PlayerService } from '@public/server/player/player.service';
import { PlayerStateService } from '@public/server/player/player.state.service';
import { ClientEvent, ServerEvent } from '@public/shared/event';

@Provider()
export class VehicleTrunkHideProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(PlayerStateService)
    private playerStateService: PlayerStateService;

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
}
