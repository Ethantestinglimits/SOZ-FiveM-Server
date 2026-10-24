import { Module } from '../../core/decorators/module';
import { AnimationEmoteProvider } from './animation.emote.provider';
import { AnimationHandsUpProvider } from './animation.handsup.provider';
import { AnimationPointProvider } from './animation.point.provider';
import { AnimationProvider } from './animation.provider';
import { AnimationRagdollProvider } from './animation.ragdoll.provider';
import { AnimationReviewProvider } from './animation.review.provider';
import { SeatAnimationProvider } from './animation.world.provider';

@Module({
    providers: [
        AnimationEmoteProvider,
        AnimationHandsUpProvider,
        AnimationPointProvider,
        AnimationProvider,
        AnimationRagdollProvider,
        AnimationReviewProvider,
        SeatAnimationProvider,
    ],
})
export class AnimationModule {}
