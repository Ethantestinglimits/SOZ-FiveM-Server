import { Module } from '../../core/decorators/module';
import { PauseMinimapProvider } from './minimap.provider';
import { PauseMenuProvider } from './pause.menu.provider';
import { PauseNativeSettingsProvider } from './pause.native.provider';
import { PauseSettingsProvider } from './pause.settings.provider';

@Module({
    providers: [PauseMenuProvider, PauseMinimapProvider, PauseNativeSettingsProvider, PauseSettingsProvider],
})
export class PauseModule {}
