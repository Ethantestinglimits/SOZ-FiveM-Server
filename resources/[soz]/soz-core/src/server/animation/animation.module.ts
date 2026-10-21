import { Module } from '../../core/decorators/module';
import { PropAnimationProvider } from './prop.animation.provider';

@Module({
    providers: [PropAnimationProvider],
})
export class AnimationModule {}
