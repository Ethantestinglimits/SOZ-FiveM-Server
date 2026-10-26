import { Module } from '../../core/decorators/module';
import { PauseMenuProvider } from './pause.menu.provider';

@Module({
    providers: [PauseMenuProvider],
})
export class PauseModule {}
