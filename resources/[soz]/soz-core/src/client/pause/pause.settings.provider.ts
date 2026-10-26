import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import { PAUSE_NATIVE_CONVARS, PauseSettingChange, PauseSettingsData } from '../../shared/nui/pause_settings';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMinimapProvider } from './minimap.provider';

@Provider()
export class PauseSettingsProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PauseMinimapProvider)
    private pauseMinimapProvider: PauseMinimapProvider;

    public getSettings(): PauseSettingsData {
        const native: Record<string, number> = {};

        for (const convar of PAUSE_NATIVE_CONVARS) {
            native[convar] = GetConvarInt(convar, -1);
        }

        return {
            server: {
                mapAnimation: this.pauseMinimapProvider.isAnimationEnabled(),
            },
            native,
        };
    }

    @OnNuiEvent(NuiEvent.PauseMenuSetSetting)
    public async onSetSetting({ key, value }: PauseSettingChange): Promise<void> {
        this.apply(key, value);
        this.nuiDispatch.dispatch('pause_menu', 'Settings', this.getSettings());
    }

    @OnNuiEvent(NuiEvent.PauseMenuResetSettings)
    public async onResetSettings(): Promise<void> {
        this.apply('mapAnimation', true);
        this.nuiDispatch.dispatch('pause_menu', 'Settings', this.getSettings());
    }

    private apply(key: string, value: PauseSettingChange['value']): void {
        if (key === 'mapAnimation') {
            this.pauseMinimapProvider.setAnimationEnabled(Boolean(value));
        }
    }
}
