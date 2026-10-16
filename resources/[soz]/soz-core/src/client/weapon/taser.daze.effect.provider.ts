import { TaserConfig } from '../../config/taser';
import { OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { ClientEvent } from '../../shared/event';
import { anchorDaze, DazeState, getDazeIntensity } from '../../shared/taser';
import { AudioService } from '../nui/audio.service';
import { NuiDispatch } from '../nui/nui.dispatch';

@Provider()
export class TaserDazeEffectProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(AudioService)
    private audioService: AudioService;

    private dazeState: DazeState | null = null;

    private overlayVisible = false;

    private buzzAudioId: string | null = null;

    @OnEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE)
    public onUpdateDaze(duration: number | null) {
        this.dazeState = duration === null ? null : anchorDaze(Date.now(), duration);

        if (!this.dazeState) {
            this.stopEffect();
        }
    }

    @Tick(100)
    public onEffectTick() {
        if (!this.dazeState) {
            this.stopEffect();

            return;
        }

        const intensity = getDazeIntensity(this.dazeState, Date.now());

        if (intensity <= 0) {
            this.dazeState = null;
            this.stopEffect();

            return;
        }

        const volume = intensity * TaserConfig.buzz.maxVolume;

        this.nuiDispatch.dispatch('taser', 'setDazeIntensity', intensity);
        this.overlayVisible = true;

        if (this.buzzAudioId === null) {
            this.buzzAudioId = this.audioService.playAudio(TaserConfig.buzz.path, volume, true);

            return;
        }

        this.audioService.volumeAudio({ id: this.buzzAudioId, path: TaserConfig.buzz.path, volume });
    }

    private stopEffect() {
        if (this.overlayVisible) {
            this.nuiDispatch.dispatch('taser', 'setDazeIntensity', 0);
            this.overlayVisible = false;
        }

        if (this.buzzAudioId !== null) {
            this.audioService.stopAudio(this.buzzAudioId);
            this.buzzAudioId = null;
        }
    }
}
