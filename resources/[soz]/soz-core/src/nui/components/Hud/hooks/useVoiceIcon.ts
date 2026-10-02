import { useMemo, useState } from 'react';

import { VoiceMode } from '../../../../shared/hud';
import { useNuiEvent } from '../../../hook/nui';
import { useHudColor } from './useHudColor';

export const useVoiceIcon = (): [string, boolean] => {
    const [voiceMode, setVoiceMode] = useState(VoiceMode.Normal);
    const [voiceActive, setVoiceActive] = useState(true);

    const { imagePrefix } = useHudColor();

    useNuiEvent('hud', 'UpdateVoiceMode', setVoiceMode);
    useNuiEvent('hud', 'UpdateVoiceActive', setVoiceActive);

    return useMemo(() => {
        if (!voiceActive) {
            return [`${imagePrefix}disconnected`, true];
        }

        switch (voiceMode) {
            case VoiceMode.Mute:
                return ['mute', true];
            case VoiceMode.Whisper:
                return ['whisper', false];
            case VoiceMode.Normal:
                return ['normal', false];
            case VoiceMode.Shouting:
                return ['shouting', false];
            case VoiceMode.Microphone:
                return ['microphone', false];
            case VoiceMode.Megaphone:
                return ['megaphone', false];
        }
    }, [voiceActive, voiceMode, imagePrefix]);
};
