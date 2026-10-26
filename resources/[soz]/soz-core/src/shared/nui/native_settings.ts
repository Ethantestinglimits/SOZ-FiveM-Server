import { PauseNativeConvar } from './pause_settings';

export const NATIVE_LANDING_PAGE = 140;
export const NATIVE_SETTINGS_PAGE = 51;

export const NATIVE_CATEGORIES = {
    sound: 3,
} as const;

export type NativeSliderRoute = {
    category: number;
    row: number;
    upFirst: number;
    min: number;
    max: number;
};

export const NATIVE_SLIDERS: Partial<Record<PauseNativeConvar, NativeSliderRoute>> = {
    profile_sfxVolume: { category: NATIVE_CATEGORIES.sound, row: 8, upFirst: 2, min: 0, max: 10 },
    profile_musicVolume: { category: NATIVE_CATEGORIES.sound, row: 38, upFirst: 0, min: 0, max: 10 },
};

export const isNativeSlider = (key: string): key is PauseNativeConvar => key in NATIVE_SLIDERS;
