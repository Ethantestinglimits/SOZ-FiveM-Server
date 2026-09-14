import { PhoneConfig } from './config';

export type PhoneDeviceSettings = Partial<PhoneConfig>;

export type PhoneDevice = {
    id: string;
    frame: string;
    simNumber: string | null;
    initialized: boolean;
    isMain: boolean;
    hasPinCode: boolean;
    isOwner: boolean;
    isLocked: boolean;
    settings: PhoneDeviceSettings;
};

export type PhoneDeviceSetup = {
    settings: PhoneDeviceSettings;
    pinCode: string;
};

export type PhoneDeviceUnlockError = 'invalid_code' | 'too_many_attempts';

export type PhoneDeviceUnlockResult = {
    device: PhoneDevice | null;
    error: PhoneDeviceUnlockError | null;
    retryIn: number;
};

export const PHONE_PIN_CODE_LENGTH = 4;

export const isValidPinCode = (pinCode: unknown): pinCode is string =>
    typeof pinCode === 'string' && /^\d{4}$/.test(pinCode);

export const PHONE_ITEM = 'phone';
export const ZIM_CARD_ITEM = 'zim_card';
