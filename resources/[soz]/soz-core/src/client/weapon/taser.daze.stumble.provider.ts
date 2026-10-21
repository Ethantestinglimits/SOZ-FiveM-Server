import { TaserConfig } from '../../config/taser';
import { OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { ClientEvent } from '../../shared/event';
import { anchorDaze, DazeState, getDazeIntensity, getStumbleDelay } from '../../shared/taser';
import { PlayerService } from '../player/player.service';
import { PlayerWalkstyleProvider } from '../player/player.walkstyle.provider';

const BALANCE_RAGDOLL_TYPE = 2;

@Provider()
export class TaserDazeStumbleProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(PlayerWalkstyleProvider)
    private playerWalkstyleProvider: PlayerWalkstyleProvider;

    private dazeState: DazeState | null = null;

    private nextStumbleAt: number | null = null;

    @OnEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE)
    public async onUpdateDaze(duration: number | null) {
        const now = Date.now();

        this.dazeState = duration === null ? null : anchorDaze(now, duration);
        this.scheduleStumble(now, 1);

        await this.playerWalkstyleProvider.updateWalkStyle(
            'taser',
            duration === null ? null : TaserConfig.daze.walkStyle
        );
    }

    @Tick(250)
    public onStumbleTick() {
        if (!this.dazeState || this.nextStumbleAt === null) {
            return;
        }

        const now = Date.now();

        if (now < this.nextStumbleAt) {
            return;
        }

        if (this.canStumble()) {
            const { ragdollDurationMs } = TaserConfig.stumble;

            SetPedToRagdoll(
                PlayerPedId(),
                ragdollDurationMs,
                ragdollDurationMs,
                BALANCE_RAGDOLL_TYPE,
                false,
                false,
                false
            );
        }

        this.scheduleStumble(now, getDazeIntensity(this.dazeState, now));
    }

    private scheduleStumble(now: number, intensity: number) {
        if (!this.dazeState) {
            this.nextStumbleAt = null;

            return;
        }

        const delay = getStumbleDelay(intensity, Math.random());

        this.nextStumbleAt = delay === null ? null : now + delay;
    }

    private canStumble(): boolean {
        const ped = PlayerPedId();

        return (
            this.playerService.canDoAction() &&
            !this.playerService.getState().isEscorted &&
            !IsPedInAnyVehicle(ped, false) &&
            !IsPedRagdoll(ped) &&
            !IsPedFalling(ped) &&
            !IsPedSwimming(ped) &&
            !IsPedClimbing(ped)
        );
    }
}
