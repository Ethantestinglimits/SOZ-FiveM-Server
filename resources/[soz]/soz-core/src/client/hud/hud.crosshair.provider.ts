import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import {
    CrosshairConfig,
    CrosshairProfiles,
    DEFAULT_CROSSHAIR,
    sanitizeCrosshair,
    sanitizeCrosshairProfiles,
} from '../../shared/nui/crosshair';
import { NuiDispatch } from '../nui/nui.dispatch';

const CROSSHAIR_KVP = 'soz_crosshair';
const CROSSHAIR_PROFILES_KVP = 'soz_crosshair_profiles';

@Provider()
export class HudCrosshairProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private profiles: CrosshairProfiles = this.load();
    private visible = false;

    public getConfig(): CrosshairConfig {
        return this.profiles.profiles.find(profile => profile.id === this.profiles.active).config;
    }

    public getProfiles(): CrosshairProfiles {
        return this.profiles;
    }

    public isCustomized(): boolean {
        return this.getConfig().customized;
    }

    public setVisible(visible: boolean): void {
        if (visible === this.visible) {
            return;
        }

        this.visible = visible;
        this.nuiDispatch.dispatch('crosshair', 'Visible', visible);
    }

    @Once(OnceStep.NuiLoaded)
    public sendConfig(): void {
        this.nuiDispatch.dispatch('crosshair', 'Config', this.getConfig());
    }

    @OnNuiEvent(NuiEvent.CrosshairSet)
    public async onSet(config: CrosshairConfig): Promise<void> {
        this.setActiveConfig({ ...sanitizeCrosshair(config), customized: true });
    }

    @OnNuiEvent(NuiEvent.CrosshairProfilesSet)
    public async onProfilesSet(profiles: CrosshairProfiles): Promise<CrosshairProfiles> {
        this.profiles = sanitizeCrosshairProfiles(profiles);
        this.save();
        this.sendConfig();

        return this.profiles;
    }

    @OnNuiEvent(NuiEvent.CrosshairReset)
    public async onReset(): Promise<void> {
        this.reset();
    }

    public reset(): void {
        this.setActiveConfig({ ...DEFAULT_CROSSHAIR });
    }

    private setActiveConfig(config: CrosshairConfig): void {
        this.profiles = {
            ...this.profiles,
            profiles: this.profiles.profiles.map(profile =>
                profile.id === this.profiles.active ? { ...profile, config } : profile
            ),
        };
        this.save();
        this.sendConfig();
    }

    private save(): void {
        SetResourceKvp(CROSSHAIR_PROFILES_KVP, JSON.stringify(this.profiles));
    }

    private load(): CrosshairProfiles {
        try {
            const saved = GetResourceKvpString(CROSSHAIR_PROFILES_KVP);

            if (saved) {
                return sanitizeCrosshairProfiles(JSON.parse(saved));
            }

            const legacy = GetResourceKvpString(CROSSHAIR_KVP);

            return sanitizeCrosshairProfiles({
                active: 'default',
                profiles: [
                    {
                        id: 'default',
                        name: 'Mon viseur',
                        config: legacy ? sanitizeCrosshair(JSON.parse(legacy)) : { ...DEFAULT_CROSSHAIR },
                    },
                ],
            });
        } catch {
            return sanitizeCrosshairProfiles(null);
        }
    }
}
