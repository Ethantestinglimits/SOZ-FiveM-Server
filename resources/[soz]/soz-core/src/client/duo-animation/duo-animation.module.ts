import { Module } from '../../core/decorators/module';
import { DuoAnimationProvider } from './duo-animation.provider';
import { DuoAnimationTargetProvider } from './duo-animation.target.provider';

@Module({
    providers: [DuoAnimationProvider, DuoAnimationTargetProvider],
})
export class DuoAnimationModule {}
