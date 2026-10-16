import { Command } from '../../core/decorators/command';
import { On, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { DazeState, extendDaze, getDazeRemaining, startDaze } from '../../shared/taser';
import { PlayerStateService } from '../player/player.state.service';

@Provider()
export class TaserDazeProvider {
    @Inject(PlayerStateService)
    private playerStateService: PlayerStateService;

    private stateBySource = new Map<number, DazeState>();

    private timeoutBySource = new Map<number, NodeJS.Timeout>();

    @OnEvent(ServerEvent.PLAYER_TASER_ELECTROCUTION_ENDED)
    public onElectrocutionEnded(source: number) {
        this.daze(source);
    }

    @OnEvent(ServerEvent.PLAYER_TASER_FORCE_DAZE)
    @Command('forcedaze', { role: 'admin', description: 'Déclencher un étourdissement de taser sur soi-même' })
    public forceDaze(source: number) {
        this.daze(source);
    }

    @OnEvent(ServerEvent.PLAYER_LOADED, false)
    public onPlayerLoaded(source: number) {
        this.endDaze(source);
    }

    @On('QBCore:Server:PlayerUnload', false)
    public onPlayerUnload(source: number) {
        this.endDaze(source);
    }

    @OnEvent(ServerEvent.LSMC_ON_DEATH)
    public onDeath(source: number) {
        this.endDaze(source);
    }

    public purgeDaze(source: number) {
        this.endDaze(source);
    }

    private daze(source: number) {
        if (this.playerStateService.getClientState(source).isDead) {
            return;
        }

        const now = Date.now();
        const current = this.stateBySource.get(source);
        const state = current ? extendDaze(current, now, Math.random()) : startDaze(now, Math.random());
        const remaining = getDazeRemaining(state, now);

        if (remaining <= 0) {
            this.endDaze(source);

            return;
        }

        this.clearDazeTimeout(source);
        this.stateBySource.set(source, state);
        this.timeoutBySource.set(
            source,
            setTimeout(() => this.endDaze(source), remaining)
        );

        this.publishDaze(source, remaining);
    }

    private endDaze(source: number) {
        this.clearDazeTimeout(source);
        this.stateBySource.delete(source);

        this.publishDaze(source, null);
    }

    private publishDaze(source: number, duration: number | null) {
        this.playerStateService.setClientState(source, { isDazed: duration !== null });
        TriggerClientEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE, source, duration);
    }

    private clearDazeTimeout(source: number) {
        const timeout = this.timeoutBySource.get(source);

        if (timeout) {
            clearTimeout(timeout);
            this.timeoutBySource.delete(source);
        }
    }
}
