import { TaserConfig } from '../../config/taser';
import { OnEvent } from '../../core/decorators/event';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { anchorDaze, DazeState, getDazeIntensity } from '../../shared/taser';

@Provider()
export class TaserDazeProvider {
    private dazeState: DazeState | null = null;

    private wasElectrocuted = false;

    private swaying = false;

    @OnEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE)
    public onUpdateDaze(duration: number | null) {
        this.dazeState = duration === null ? null : anchorDaze(Date.now(), duration);
    }

    @OnEvent(ClientEvent.PLAYER_ON_DEATH)
    @OnEvent(ClientEvent.LSMC_REVIVE)
    public onPurgeDaze() {
        this.wasElectrocuted = false;
        this.onUpdateDaze(null);
    }

    @Tick(100)
    public onElectrocutionTick() {
        const playerPed = PlayerPedId();

        if (IsPedBeingStunned(playerPed, 0)) {
            this.wasElectrocuted = true;

            return;
        }

        if (this.wasElectrocuted && !IsPedRagdoll(playerPed)) {
            this.wasElectrocuted = false;

            TriggerServerEvent(ServerEvent.PLAYER_TASER_ELECTROCUTION_ENDED);
        }
    }

    @Tick(100)
    public onCameraSwayTick() {
        if (!this.dazeState) {
            if (this.swaying) {
                StopGameplayCamShaking(true);
                this.swaying = false;
            }

            return;
        }

        if (!this.swaying) {
            ShakeGameplayCam(TaserConfig.cameraSway.shake, TaserConfig.cameraSway.maxAmplitude);
            this.swaying = true;
        }

        SetGameplayCamShakeAmplitude(
            getDazeIntensity(this.dazeState, Date.now()) * TaserConfig.cameraSway.maxAmplitude
        );
    }
}
