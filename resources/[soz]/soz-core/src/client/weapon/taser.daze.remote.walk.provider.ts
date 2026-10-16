import { TaserConfig } from '../../config/taser';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { PlayerListStateService } from '../player/player.list.state.service';
import { ResourceLoader } from '../repository/resource.loader';

@Provider()
export class TaserDazeRemoteWalkProvider {
    @Inject(PlayerListStateService)
    private playerListStateService: PlayerListStateService;

    @Inject(ResourceLoader)
    private resourceLoader: ResourceLoader;

    private dazedPedsByServerId = new Map<number, number>();

    @Tick(500)
    public async onRemoteWalkStyleTick() {
        const walkStyle = TaserConfig.daze.walkStyle;
        const ownServerId = GetPlayerServerId(PlayerId());
        const dazedPlayers = new Set(
            this.playerListStateService.getDazedPlayers().filter(serverId => serverId !== ownServerId)
        );

        if (dazedPlayers.size > 0) {
            await this.resourceLoader.loadAnimationSet(walkStyle);
        }

        for (const serverId of dazedPlayers) {
            const player = GetPlayerFromServerId(serverId);

            if (player === -1) {
                continue;
            }

            const ped = GetPlayerPed(player);

            if (!DoesEntityExist(ped)) {
                continue;
            }

            if (GetPedMovementClipset(ped) !== GetHashKey(walkStyle)) {
                SetPedMovementClipset(ped, walkStyle, 1.0);
            }

            this.dazedPedsByServerId.set(serverId, ped);
        }

        for (const [serverId, ped] of this.dazedPedsByServerId) {
            if (dazedPlayers.has(serverId)) {
                continue;
            }

            if (DoesEntityExist(ped) && GetPedMovementClipset(ped) === GetHashKey(walkStyle)) {
                ResetPedMovementClipset(ped, 1.0);
            }

            this.dazedPedsByServerId.delete(serverId);
        }
    }
}
