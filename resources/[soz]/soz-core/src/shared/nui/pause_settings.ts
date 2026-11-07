import { CrosshairConfig } from './crosshair';

export const PAUSE_NATIVE_CONVARS = [
    'profile_sfxVolume',
    'profile_musicVolume',
    'profile_musicVolumeInMp',
    'profile_audioMuteOnFocusLoss',
    'profile_gamma',
    'profile_safezoneSize',
    'profile_subtitles',
    'profile_measurementSystem',
    'profile_currentLanguage',
    'profile_targetConfig',
    'profile_invertMouse',
    'profile_invertLook',
    'profile_vibration',
    'profile_kbmToggleAim',
    'profile_alternateHandbrake',
    'profile_alternateDriveby',
    'profile_mouseOnFootScale',
    'profile_mouseDrivingScale',
    'profile_fpsFieldOfView',
    'profile_cameraHeight',
    'profile_hoodCamera',
    'profile_cinematicShooting',
    'profile_fpsHeadbob',
    'profile_fpsRagdoll',
    'profile_fpsCombatroll',
    'profile_fpsAutoLevel',
    'profile_fpsPersistantView',
    'profile_fpsThirdPersonCover',
    'profile_fpsVehAutoCenter',
    'profile_fpsRelativeVehicleCameraDrivebyAiming',
    'profile_advGfxLongShadows',
    'profile_advGfxUltraShadows',
    'profile_advGfxHdFlight',
    'profile_advGfxMaxLod',
    'profile_advGfxShadowsDistMult',
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
