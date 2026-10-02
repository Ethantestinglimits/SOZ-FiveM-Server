import { Module } from '../../core/decorators/module';
import { AnimationCalibrateProvider } from './animation.calibrate.provider';
import { AnimationHandsUpProvider } from './animation.handsup.provider';
import { AnimationPointProvider } from './animation.point.provider';
import { AnimationPropProvider } from './animation.prop.provider';
import { AnimationProvider } from './animation.provider';
import { AnimationRagdollProvider } from './animation.ragdoll.provider';
import { SeatAnimationProvider } from './animation.world.provider';

@Module({
    providers: [
        AnimationCalibrateProvider,
        AnimationHandsUpProvider,
        AnimationPropProvider,
        AnimationPointProvider,
        AnimationProvider,
        AnimationRagdollProvider,
        SeatAnimationProvider,
    ],
})
export class AnimationModule {}
