import { Module } from '../../core/decorators/module';
import { PauseMinimapProvider } from './minimap.provider';
import { PauseMinimapStyleProvider } from './minimap.style.provider';
import { PauseGraphicsProvider } from './pause.graphics.provider';
import { PauseMenuProvider } from './pause.menu.provider';
import { PauseNativeSettingsProvider } from './pause.native.provider';
import { PauseSettingsProvider } from './pause.settings.provider';

@Module({
    providers: [
        PauseGraphicsProvider,
        PauseMenuProvider,
        PauseMinimapProvider,
        PauseMinimapStyleProvider,
        PauseNativeSettingsProvider,
        PauseSettingsProvider,
    ],
})
export class PauseModule {}
