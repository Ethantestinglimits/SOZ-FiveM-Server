import { TaserConfig } from '../../config/taser';
import { Command } from '../../core/decorators/command';
import { OnEvent, Once, OnceStep } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { ClientEvent } from '../../shared/event';
import { anchorDaze, DazeState, getDazeIntensity } from '../../shared/taser';
import { NuiDispatch } from '../nui/nui.dispatch';
import { BlurService } from '../utils/blur.service';

const BLUR_REASON = 'taser';

@Provider()
export class TaserDazeEffectProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(BlurService)
    private blurService: BlurService;

    private dazeState: DazeState | null = null;

    private effectVisible = false;

    private blurred = false;

    private timecycle = TaserConfig.visual.timecycle;

    private maxTimecycleStrength = TaserConfig.visual.maxTimecycleStrength;

    @OnEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE)
    public onUpdateDaze(duration: number | null) {
        this.dazeState = duration === null ? null : anchorDaze(Date.now(), duration);

        if (!this.dazeState) {
            this.stopEffect();
        }
    }

    @Command('taser_daze_timecycle', { role: 'admin', description: "Changer le timecycle de l'étourdissement" })
    public setTimecycle(_source: number, timecycle?: string, strength?: string) {
        this.timecycle = timecycle || TaserConfig.visual.timecycle;
        this.maxTimecycleStrength = strength ? Number(strength) : TaserConfig.visual.maxTimecycleStrength;

        if (this.effectVisible) {
            SetTimecycleModifier(this.timecycle);
        }
    }

    @Once(OnceStep.Stop)
    public onStop() {
        this.stopEffect();
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

        this.updateInitialBlur(Date.now() - this.dazeState.startedAt < TaserConfig.visual.initialBlurMs);

        if (!this.effectVisible) {
            PushTimecycleModifier();
            SetTimecycleModifier(this.timecycle);
            this.effectVisible = true;
        }

        SetTimecycleModifierStrength(
            Math.pow(intensity, TaserConfig.visual.timecycleFadeExponent) * this.maxTimecycleStrength,
        );
        this.nuiDispatch.dispatch('taser', 'setDazeIntensity', intensity);
    }

    private updateInitialBlur(active: boolean) {
        if (active === this.blurred) {
            return;
        }

        if (active) {
            this.blurService.add(BLUR_REASON, TaserConfig.visual.initialBlurFadeInMs);
        } else {
            this.blurService.remove(BLUR_REASON, TaserConfig.visual.initialBlurFadeOutMs);
        }

        this.blurred = active;
    }

    private stopEffect() {
        this.updateInitialBlur(false);

        if (!this.effectVisible) {
            return;
        }

        ClearTimecycleModifier();
        PopTimecycleModifier();
        this.nuiDispatch.dispatch('taser', 'setDazeIntensity', 0);
        this.effectVisible = false;
    }
}
