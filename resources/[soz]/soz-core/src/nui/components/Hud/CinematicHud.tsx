import { animated, easings, useSpring } from '@react-spring/web';
import { FunctionComponent, useState } from 'react';

import { useNuiEvent } from '../../hook/nui';
import { VoiceIcon } from './components/VoiceIcon';
import { useVoiceIcon } from './hooks/useVoiceIcon';

const CINEMATIC_BAR_HEIGHT_VH = 10;

export const CinematicHud: FunctionComponent = () => {
    const [{ active, duration }, setCinematic] = useState({ active: false, duration: 0 });
    const [voiceIcon, disableAutoHide] = useVoiceIcon();

    useNuiEvent('hud', 'SetCinematicHud', setCinematic);

    const styles = useSpring({
        to: {
            bottom: `${active ? CINEMATIC_BAR_HEIGHT_VH / 2 : -CINEMATIC_BAR_HEIGHT_VH / 2}vh`,
        },
        immediate: duration <= 0,
        config: { duration, easing: easings.easeInOutCubic },
    });

    return (
        <animated.div className="absolute left-[2vw] translate-y-1/2 drop-shadow-bg" style={styles}>
            <VoiceIcon key={String(active)} icon={voiceIcon} disableAutoHide={disableAutoHide} />
        </animated.div>
    );
};
