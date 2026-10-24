import { Module } from '../../core/decorators/module';
import { AnimationCalibrateProvider } from './animation.calibrate.provider';
import { AnimationEmoteProvider } from './animation.emote.provider';
import { AnimationHandsUpProvider } from './animation.handsup.provider';
import { AnimationPointProvider } from './animation.point.provider';
import { AnimationPreviewProvider } from './animation.preview.provider';
import { AnimationPropProvider } from './animation.prop.provider';
import { AnimationProvider } from './animation.provider';
import { AnimationRagdollProvider } from './animation.ragdoll.provider';
import { AnimationReviewProvider } from './animation.review.provider';
import { SeatAnimationProvider } from './animation.world.provider';

@Module({
    providers: [
        AnimationCalibrateProvider,
        AnimationEmoteProvider,
        AnimationHandsUpProvider,
        AnimationPropProvider,
        AnimationPointProvider,
        AnimationPreviewProvider,
        AnimationProvider,
        AnimationRagdollProvider,
        AnimationReviewProvider,
        SeatAnimationProvider,
    ],
})
export class AnimationModule {}
