import { animated, easings, useSpring } from '@react-spring/web';
import { FunctionComponent, useState } from 'react';

import { useNuiEvent } from '../../hook/nui';
import { VoiceIcon } from './components/VoiceIcon';
import { useVoiceIcon } from './hooks/useVoiceIcon';

// Must match CINEMATIC_BAR_HEIGHT in client/hud/hud.state.provider.ts (fraction of the screen height)
const CINEMATIC_BAR_HEIGHT_VH = 10;

/**
 * HUD shown while the cinematic black bars are displayed: the regular HUD is hidden,
 * so the voice range icon moves inside the bottom bar and slides in with it.
 */
export const CinematicHud: FunctionComponent = () => {
    const [{ active, duration }, setCinematic] = useState({ active: false, duration: 0 });
    const [voiceIcon, disableAutoHide] = useVoiceIcon();

    useNuiEvent('hud', 'SetCinematicHud', setCinematic);

    const styles = useSpring({
        to: {
            // Vertically centered in the bottom bar when shown, below the screen when hidden
            bottom: `${active ? CINEMATIC_BAR_HEIGHT_VH / 2 : -CINEMATIC_BAR_HEIGHT_VH / 2}vh`,
        },
        immediate: duration <= 0,
        config: { duration, easing: easings.easeInOutCubic },
    });

    return (
        <animated.div className="absolute left-[2vw] translate-y-1/2 drop-shadow-bg" style={styles}>
            {/* Remount on toggle so the current range is shown for a few seconds when the bars appear */}
            <VoiceIcon key={String(active)} icon={voiceIcon} disableAutoHide={disableAutoHide} />
        </animated.div>
    );
};
