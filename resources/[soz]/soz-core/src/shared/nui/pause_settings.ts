import { CrosshairConfig } from './crosshair';

export const PAUSE_NATIVE_CONVARS = [
    'profile_sfxVolume',
    'profile_musicVolume',
    'profile_gamma',
    'profile_safezoneSize',
    'profile_measurementSystem',
    'profile_currentLanguage',
    'profile_vibration',
    'profile_invertMouse',
    'profile_mouseOnFootScale',
    'profile_targetConfig',
    'profile_fpsFieldOfView',
    'profile_cameraHeight',
] as const;

export type PauseNativeConvar = (typeof PAUSE_NATIVE_CONVARS)[number];

export type PauseServerSettingValue = boolean | number | string;

export type PauseSettingsData = {
    server: Record<string, PauseServerSettingValue>;
    native: Record<string, number>;
    crosshair: CrosshairConfig;
};

export type PauseSettingChange = {
    key: string;
    value: PauseServerSettingValue;
};
