export type PhoneDeviceSettings = {
    theme?: 'light' | 'dark';
    wallpaper?: string;
    ringtone?: string;
};

export type PhoneDevice = {
    id: string;
    frame: string;
    simNumber: string | null;
    initialized: boolean;
    isMain: boolean;
    hasPinCode: boolean;
    settings: PhoneDeviceSettings;
};

export const PHONE_ITEM = 'phone';
export const ZIM_CARD_ITEM = 'zim_card';
