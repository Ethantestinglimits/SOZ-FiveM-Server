import { atom, useAtomValue, useSetAtom } from 'jotai';

import { PhoneConfig } from '../../../../../shared/phone/config';
import { PhoneDevice } from '../../../../../shared/phone/device';
import { defaultConfig } from './default.constant';

const LEGACY_CONFIG_STORAGE_KEY = 'soz_phone_settings';
const ZOOM_STORAGE_KEY = 'soz_phone_zoom';

const configAtom = atom<PhoneConfig>(defaultConfig);

const themeConfigAtom = atom(get => get(configAtom).theme.value);
const frameConfigAtom = atom(get => get(configAtom).frame.value);
const wallpaperConfigAtom = atom(get => get(configAtom).wallpaper.value);
const planeModeAtom = atom(get => get(configAtom).planeMode);
const zoomAtom = atom(get => get(configAtom).zoom.value);
const handsFreeAtom = atom(get => get(configAtom).handsFree);
const hidePicturesAtom = atom(get => get(configAtom).hidePictures);
const textZoomAtom = atom(get => get(configAtom).textZoom.value);
const dynamicAlertAtom = atom(get => get(configAtom).dynamicAlert);
const dynamicAlertDurationAtom = atom(get => get(configAtom).dynamicAlertDuration.value);

export const useConfig = () => useAtomValue(configAtom);
export const useSetConfig = () => useSetAtom(configAtom);

export const useThemeConfig = () => useAtomValue(themeConfigAtom);
export const useFrameConfig = () => useAtomValue(frameConfigAtom);
export const useWallpaperConfig = () => useAtomValue(wallpaperConfigAtom);
export const useZoomConfig = () => useAtomValue(zoomAtom);
export const usePlaneMode = () => useAtomValue(planeModeAtom);
export const useHandsFreeConfig = () => useAtomValue(handsFreeAtom);
export const useHidePicturesConfig = () => useAtomValue(hidePicturesAtom);
export const useTextZoomConfig = () => useAtomValue(textZoomAtom);
export const useDynamicAlertConfig = () => useAtomValue(dynamicAlertAtom);
export const useDynamicAlertDurationConfig = () => useAtomValue(dynamicAlertDurationAtom);

const readLegacyConfig = (): Partial<PhoneConfig> | null => {
    try {
        const raw = window.localStorage.getItem(LEGACY_CONFIG_STORAGE_KEY);

        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
};

const readLocalZoom = (): PhoneConfig['zoom'] => {
    try {
        const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);

        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        return defaultConfig.zoom;
    }

    return readLegacyConfig()?.zoom || defaultConfig.zoom;
};

export const saveLocalZoom = (zoom: PhoneConfig['zoom']): void => {
    try {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(zoom));
    } catch (e) {
        return;
    }
};

export const toDeviceSettings = (config: PhoneConfig): Partial<PhoneConfig> => {
    const deviceSettings: Partial<PhoneConfig> = { ...config };

    delete deviceSettings.zoom;

    return deviceSettings;
};

export const resolveDeviceConfig = (device: PhoneDevice | null): { config: PhoneConfig; seeded: boolean } => {
    const zoom = readLocalZoom();

    if (device?.settings && Object.keys(device.settings).length > 0) {
        return { config: { ...defaultConfig, ...device.settings, zoom }, seeded: false };
    }

    if (device?.isMain) {
        const legacyConfig = readLegacyConfig();

        if (legacyConfig) {
            return { config: { ...defaultConfig, ...legacyConfig, zoom }, seeded: device.initialized };
        }
    }

    return { config: { ...defaultConfig, zoom }, seeded: false };
};
