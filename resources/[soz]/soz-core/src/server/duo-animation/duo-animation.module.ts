import { Module } from '../../core/decorators/module';
import { DuoAnimationProvider } from './duo-animation.provider';

@Module({
    providers: [DuoAnimationProvider],
})
export class DuoAnimationModule {}
