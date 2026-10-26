import { Module } from '../../core/decorators/module';
import { PauseProvider } from './pause.provider';

@Module({
    providers: [PauseProvider],
})
export class PauseModule {}
