import { Module } from '../../core/decorators/module';
import { PauseMinimapProvider } from './minimap.provider';
import { PauseMenuProvider } from './pause.menu.provider';

@Module({
    providers: [PauseMenuProvider, PauseMinimapProvider],
})
export class PauseModule {}
