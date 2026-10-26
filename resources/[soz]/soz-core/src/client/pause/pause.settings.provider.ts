import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import { PAUSE_NATIVE_CONVARS, PauseSettingChange, PauseSettingsData } from '../../shared/nui/pause_settings';
import { HudGlassmorphismProvider } from '../hud/hud.glassmorphism.provider';
import { HudMinimapProvider } from '../hud/hud.minimap.provider';
import { HudStateProvider } from '../hud/hud.state.provider';
import { NuiDispatch } from '../nui/nui.dispatch';
import { StreamProvider } from '../stream/stream.provider';
import { VoiceProvider } from '../voip/voice/voice.provider';
import { PauseMinimapProvider } from './minimap.provider';

const MENU_SIZE_KVP = 'soz_menu_size';
const MENU_TEXT_KVP = 'soz_menu_text';

const DEFAULTS: Record<string, boolean | number | string> = {
    potato: false,
    mapAnimation: true,
    minimapFps: 60,
    menuSize: 100,
    menuTextSize: 3,
    hudVisible: true,
    hudCinematic: false,
    hudCinematicCamera: false,
    scaledNui: false,
    glassmorphism: true,
    glassmorphismFps: 30,
    voipIntent: 'speech',
    videoVolume: 50,
};

@Provider()
export class PauseSettingsProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PauseMinimapProvider)
    private pauseMinimapProvider: PauseMinimapProvider;

    @Inject(HudStateProvider)
    private hudStateProvider: HudStateProvider;

    @Inject(HudMinimapProvider)
    private hudMinimapProvider: HudMinimapProvider;

    @Inject(HudGlassmorphismProvider)
    private hudGlassmorphismProvider: HudGlassmorphismProvider;

    @Inject(VoiceProvider)
    private voiceProvider: VoiceProvider;

    @Inject(StreamProvider)
    private streamProvider: StreamProvider;

    public getSettings(): PauseSettingsData {
        const native: Record<string, number> = {};

        for (const convar of PAUSE_NATIVE_CONVARS) {
            native[convar] = GetConvarInt(convar, -1);
        }

        const hud = this.hudStateProvider.getState();

        return {
            server: {
                potato: this.pauseMinimapProvider.isPotato(),
                mapAnimation: this.pauseMinimapProvider.isAnimationEnabled(),
                minimapFps: this.pauseMinimapProvider.getFpsLimit(),
                menuSize: this.getMenuSize(),
                menuTextSize: this.getMenuTextSize(),
                hudVisible: hud.isHudVisible,
                hudCinematic: hud.isCinematicMode,
                hudCinematicCamera: hud.isCinematicCameraActive,
                scaledNui: this.hudMinimapProvider.scaledNui,
                glassmorphism: this.hudGlassmorphismProvider.glassmorphism,
                glassmorphismFps: this.hudGlassmorphismProvider.glassmorphismFpsLimit,
                voipIntent: this.voiceProvider.intent,
                videoVolume: Math.round(this.streamProvider.videoVolume * 100),
            },
            native,
        };
    }

    @Once(OnceStep.NuiLoaded)
    public sendMenuStyle(): void {
        this.nuiDispatch.dispatch('menu', 'SetStyle', {
            size: this.getMenuSize(),
            text: this.getMenuTextSize(),
            potato: this.pauseMinimapProvider.isPotato(),
        });
    }

    private getMenuSize(): number {
        return GetResourceKvpInt(MENU_SIZE_KVP) || 100;
    }

    private getMenuTextSize(): number {
        return GetResourceKvpInt(MENU_TEXT_KVP) || 3;
    }

    @OnNuiEvent(NuiEvent.PauseMenuSetSetting)
    public async onSetSetting({ key, value }: PauseSettingChange): Promise<void> {
        await this.apply(key, value);
        this.nuiDispatch.dispatch('pause_menu', 'Settings', this.getSettings());
    }

    @OnNuiEvent(NuiEvent.PauseMenuResetSettings)
    public async onResetSettings(): Promise<void> {
        for (const [key, value] of Object.entries(DEFAULTS)) {
            await this.apply(key, value);
        }

        this.nuiDispatch.dispatch('pause_menu', 'Settings', this.getSettings());
    }

    private async apply(key: string, value: PauseSettingChange['value']): Promise<void> {
        switch (key) {
            case 'potato':
                this.pauseMinimapProvider.setPotato(Boolean(value));

                if (value) {
                    this.pauseMinimapProvider.setAnimationEnabled(false);
                    this.pauseMinimapProvider.setFpsLimit(30);
                    this.hudGlassmorphismProvider.glassmorphism = false;
                    this.hudGlassmorphismProvider.glassmorphismFpsLimit = 30;
                }

                this.sendMenuStyle();

                break;
            case 'menuSize':
                SetResourceKvpInt(MENU_SIZE_KVP, Number(value));
                this.sendMenuStyle();
                break;
            case 'menuTextSize':
                SetResourceKvpInt(MENU_TEXT_KVP, Number(value));
                this.sendMenuStyle();
                break;
            case 'mapAnimation':
                this.pauseMinimapProvider.setAnimationEnabled(Boolean(value));
                break;
            case 'minimapFps':
                this.pauseMinimapProvider.setFpsLimit(Number(value));
                break;
            case 'hudVisible':
                this.hudStateProvider.setHudVisible(Boolean(value));
                break;
            case 'hudCinematic':
                this.hudStateProvider.setCinematicMode(Boolean(value));
                break;
            case 'hudCinematicCamera':
                this.hudStateProvider.setCinematicCameraActive(Boolean(value));
                break;
            case 'scaledNui':
                this.hudMinimapProvider.scaledNui = Boolean(value);
                break;
            case 'glassmorphism':
                this.hudGlassmorphismProvider.glassmorphism = Boolean(value);
                break;
            case 'glassmorphismFps':
                this.hudGlassmorphismProvider.glassmorphismFpsLimit = Number(value);
                break;
            case 'voipIntent':
                this.voiceProvider.setIntent(String(value));
                break;
            case 'voipReset':
                await this.voiceProvider.reconnect(true, 'Demande joueur');
                break;
            case 'videoVolume':
                this.streamProvider.setVideoVolume(Number(value) / 100);
                break;
        }
    }
}
