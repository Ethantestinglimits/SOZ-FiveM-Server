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

export const PAUSE_NATIVE_EDITABLE: Partial<Record<PauseNativeConvar, { min: number; max: number }>> = {
    profile_sfxVolume: { min: 0, max: 10 },
    profile_musicVolume: { min: 0, max: 10 },
    profile_gamma: { min: 0, max: 30 },
    profile_safezoneSize: { min: 0, max: 10 },
    profile_measurementSystem: { min: 0, max: 1 },
    profile_vibration: { min: 0, max: 1 },
    profile_invertMouse: { min: 0, max: 1 },
    profile_fpsFieldOfView: { min: 0, max: 30 },
};

export type PauseNativeSettingChange = {
    convar: PauseNativeConvar;
    value: number;
};

export type PauseServerSettingValue = boolean | number | string;

export type PauseSettingsData = {
    server: Record<string, PauseServerSettingValue>;
    native: Record<string, number>;
};

export type PauseSettingChange = {
    key: string;
    value: PauseServerSettingValue;
};
