import { useTranslation } from 'react-i18next';

import { NuiEvent } from '../../../../../../shared/event/nui';
import { PhoneConfig } from '../../../../../../shared/phone/config';
import { fetchNui } from '../../../../../fetch';
import { useNotifications } from '../../notifications/hooks/useNotifications';
import { saveLocalZoom, toDeviceSettings, useConfig, useSetConfig } from '../config.atom';
import { defaultConfig } from '../default.constant';

export const useSettingsChange = () => {
    const { t } = useTranslation();
    const { addNotification } = useNotifications();

    const config = useConfig();
    const setConfig = useSetConfig();

    const saveConfig = (nextConfig: PhoneConfig) => {
        setConfig(nextConfig);
        saveLocalZoom(nextConfig.zoom);
        fetchNui(NuiEvent.PhoneDeviceSaveSettings, toDeviceSettings(nextConfig));
    };

    const handleSettingChange = (key: string | number, value: any) => {
        if (key === 'zoom') {
            if (window.innerHeight <= value.value * 10) {
                addNotification({
                    app: 'settings',
                    title: t('SETTINGS.ZOOM.WARNING'),
                });
                return;
            }
        }

        if (key === 'zoom') {
            setConfig({ ...config, zoom: value });
            saveLocalZoom(value);

            return;
        }

        if (key === 'frame') {
            fetchNui(NuiEvent.PhoneSetPropModel, { frame: value.value });
        }

        saveConfig({ ...config, [key]: value });
    };

    const resetSettings = () => {
        saveConfig(defaultConfig);
        addNotification({
            app: 'settings',
            title: 'success',
            content: t('SETTINGS.MESSAGES.SETTINGS_RESET'),
        });
    };

    return { handleSettingChange, resetSettings };
};
