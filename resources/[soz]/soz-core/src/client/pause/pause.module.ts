import { Module } from '../../core/decorators/module';
import { PauseMinimapProvider } from './minimap.provider';
import { PauseMinimapStyleProvider } from './minimap.style.provider';
import { PauseMenuProvider } from './pause.menu.provider';
import { PauseNativeSettingsProvider } from './pause.native.provider';
import { PauseSettingsProvider } from './pause.settings.provider';

@Module({
    providers: [
        PauseMenuProvider,
        PauseMinimapProvider,
        PauseMinimapStyleProvider,
        PauseNativeSettingsProvider,
        PauseSettingsProvider,
    ],
})
export class PauseModule {}
