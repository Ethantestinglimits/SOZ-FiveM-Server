import { Module } from '../../core/decorators/module';
import { AnimationHandsUpProvider } from './animation.handsup.provider';
import { AnimationPointProvider } from './animation.point.provider';
import { AnimationPreviewProvider } from './animation.preview.provider';
import { AnimationProvider } from './animation.provider';
import { AnimationRagdollProvider } from './animation.ragdoll.provider';
import { SeatAnimationProvider } from './animation.world.provider';

@Module({
    providers: [
        AnimationHandsUpProvider,
        AnimationPointProvider,
        AnimationPreviewProvider,
        AnimationProvider,
        AnimationRagdollProvider,
        SeatAnimationProvider,
    ],
})
export class AnimationModule {}
