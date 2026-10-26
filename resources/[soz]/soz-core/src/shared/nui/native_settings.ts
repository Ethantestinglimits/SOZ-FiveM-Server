import { PauseNativeConvar } from './pause_settings';

export type NativeSettingControl =
    | { kind: 'slider'; min: number; max: number }
    | { kind: 'toggle' }
    | { kind: 'select'; options: { value: number; label: string }[] };

const slider = (min: number, max: number): NativeSettingControl => ({ kind: 'slider', min, max });

const toggle: NativeSettingControl = { kind: 'toggle' };

export const NATIVE_SETTINGS: Partial<Record<PauseNativeConvar, NativeSettingControl>> = {
    profile_sfxVolume: slider(0, 10),
    profile_musicVolume: slider(0, 10),
    profile_musicVolumeInMp: slider(0, 10),
    profile_audioMuteOnFocusLoss: toggle,
    profile_gamma: slider(0, 30),
    profile_safezoneSize: slider(0, 10),
    profile_subtitles: toggle,
    profile_measurementSystem: {
        kind: 'select',
        options: [
            { value: 0, label: 'Métrique' },
            { value: 1, label: 'Impérial' },
        ],
    },
    profile_targetConfig: {
        kind: 'select',
        options: [
            { value: 0, label: 'Visée assistée complète' },
            { value: 1, label: 'Visée assistée partielle' },
            { value: 2, label: 'Visée libre assistée' },
            { value: 3, label: 'Visée libre' },
        ],
    },
    profile_invertMouse: toggle,
    profile_invertLook: toggle,
    profile_vibration: toggle,
    profile_kbmToggleAim: toggle,
    profile_alternateHandbrake: toggle,
    profile_alternateDriveby: toggle,
    profile_hoodCamera: toggle,
    profile_cinematicShooting: toggle,
    profile_fpsHeadbob: toggle,
    profile_fpsRagdoll: toggle,
    profile_fpsCombatroll: toggle,
    profile_fpsAutoLevel: toggle,
    profile_fpsPersistantView: toggle,
    profile_fpsThirdPersonCover: toggle,
    profile_fpsVehAutoCenter: toggle,
    profile_fpsRelativeVehicleCameraDrivebyAiming: toggle,
    profile_advGfxLongShadows: toggle,
    profile_advGfxUltraShadows: toggle,
    profile_advGfxHdFlight: toggle,
    profile_advGfxMaxLod: slider(0, 10),
    profile_advGfxShadowsDistMult: slider(0, 10),
};

export const isNativeSetting = (key: string): key is PauseNativeConvar => key in NATIVE_SETTINGS;

export const sanitizeNativeValue = (control: NativeSettingControl, value: number): number | null => {
    const number = Math.round(Number(value));

    if (!Number.isFinite(number)) {
        return null;
    }

    switch (control.kind) {
        case 'slider':
            return Math.min(control.max, Math.max(control.min, number));
        case 'toggle':
            return number > 0 ? 1 : 0;
        case 'select':
            return control.options.some((option) => option.value === number) ? number : null;
    }
};
