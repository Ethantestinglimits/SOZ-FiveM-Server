import { PauseNativeConvar } from './pause_settings';

export type NativeSliderRange = {
    min: number;
    max: number;
};

export const NATIVE_SLIDERS: Partial<Record<PauseNativeConvar, NativeSliderRange>> = {
    profile_sfxVolume: { min: 0, max: 10 },
    profile_musicVolume: { min: 0, max: 10 },
};

export const isNativeSlider = (key: string): key is PauseNativeConvar => key in NATIVE_SLIDERS;
