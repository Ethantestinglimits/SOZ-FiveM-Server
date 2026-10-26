import { Module } from '../../core/decorators/module';
import { PauseMinimapProvider } from './minimap.provider';
import { PauseClickProbe } from './pause.click.probe';
import { PauseMenuProvider } from './pause.menu.provider';
import { PauseNativeSettingsDriver } from './pause.native.driver';
import { PauseSettingsProvider } from './pause.settings.provider';

@Module({
    providers: [PauseMenuProvider, PauseMinimapProvider, PauseNativeSettingsDriver, PauseSettingsProvider, PauseClickProbe],
})
export class PauseModule {}
