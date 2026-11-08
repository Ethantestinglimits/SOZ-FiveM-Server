import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { FunctionComponent, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { VoiceMode } from '../../../shared/hud';
import { useHudHasStreetNames, useHudMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { RootState } from '../../store';
import { useMinimapMode } from '../Minimap/minimapState';
import { useMinimapStyle } from '../Minimap/minimapStyleState';
import { GlassMorphismBox } from '../Styleguide/GlassMorphismBox';
import { Compass } from './components/Compass';
import { DateTime } from './components/DateTime';
import { Location } from './components/Location';
import { PetStats } from './components/PetStats';
import { PlayerStats } from './components/PlayerStats';
import { VoiceIcon } from './components/VoiceIcon';
import { Weather } from './components/Weather';
import { useHudColor } from './hooks/useHudColor';
import { useHudBlock } from './hudPlacement';

export const WatchInterface: FunctionComponent = () => {
    const hasWatch = useSelector((state: RootState) => state.hud.hasWatch);
    const settings = useSelector((state: RootState) => state.hud.settings);
    const minimap = useHudMinimap();
    const minimapStyle = useMinimapStyle();
    const minimapMode = useMinimapMode();
    const frameVisible =
        minimapStyle.frame === 'visible' || (minimapStyle.frame === 'auto' && minimapStyle.shape === 'rectangle');

    const hasStreetNamesEnabled = useHudHasStreetNames();

    const [voiceMode, setVoiceMode] = useState(VoiceMode.Normal);
    const [voiceActive, setVoiceActive] = useState(true);

    const { imagePrefix } = useHudColor();

    useNuiEvent('hud', 'UpdateVoiceMode', setVoiceMode);
    useNuiEvent('hud', 'UpdateVoiceActive', setVoiceActive);

    const [voiceIcon, disableAutoHide] = useMemo(() => {
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
    }, [voiceActive, voiceMode]);

    const headerStyles = useSpring({
        from: {
            bottom: '-100vh',
        },
        to: {
            width: `${minimap.width * 100}vw`,
            bottom: `${100 - (minimap.top + 0.005) * 100}vh`,
            left: `${(minimap.left + 0.005) * 100}vw`,
        },
    });

    const footerStyles = useSpring({
        from: {
            bottom: '150vh',
        },
        to: {
            top: `${(minimap.bottom + 0.005) * 100}vh`,
            left: !settings.switchPlayerStatsPosition ? `${(minimap.left + 0.005) * 100}vw` : '0vw',
            right: settings.switchPlayerStatsPosition ? `${(minimap.left + 0.005) * 100}vw` : '0vw',
        },
    });

    const voiceStyles = useSpring({
        from: {
            bottom: '-50vh',
        },
        to: {
            bottom: `${100 - minimap.bottom * 100}vh`,
            left: settings.switchPlayerStatsPosition
                ? `${100 - (minimap.right + 0.04) * 100}vw`
                : (!hasWatch && minimap.isHidden) ||
                    (!hasStreetNamesEnabled && !settings.showWeather && !settings.showDateTime && minimap.isHidden)
                  ? `${(minimap.left + 0.005) * 100}vw`
                  : `${(minimap.right + 0.005) * 100}vw`,
        },
    });

    const voiceBlock = useHudBlock('voice', true);
    const statsBlock = useHudBlock('stats', true);
    const headerBlock = useHudBlock('datetime', true);
    const footerBlock = useHudBlock('street', true);

    return (
        <>
            <animated.div
                className={cn('absolute flex justify-between items-end text-white', {
                    'px-5': minimap.isHidden,
                })}
                ref={headerBlock.ref}
                style={{ ...headerStyles, ...headerBlock.style }}
            >
                <DateTime />
                <Weather />
            </animated.div>

            {hasWatch && !minimap.isHidden && minimapMode === 'minimap' && frameVisible && (
                <GlassMorphismBox
                    className="rounded-lg"
                    style={{
                        top: `${(minimap.top + 0.0105) * 100}vh`,
                        height: `${(minimap.height - 0.015) * 100}vh`,
                        left: `${(minimap.left + 0.0045) * 100}vw`,
                        width: `${minimap.width * 100}vw`,
                    }}
                />
            )}

            <animated.div
                className={cn('absolute size-12 drop-shadow-bg ml-3', {
                    'mb-14': !hasStreetNamesEnabled,
                })}
                ref={voiceBlock.ref}
                style={{ ...voiceStyles, ...voiceBlock.style }}
            >
                <VoiceIcon icon={voiceIcon} disableAutoHide={disableAutoHide} />
            </animated.div>

            <animated.div
                className={cn('absolute flex gap-3 text-white h-fit', {
                    '-mt-14': !hasStreetNamesEnabled,
                    'flex-row-reverse': settings.switchPlayerStatsPosition,
                })}
                ref={footerBlock.ref}
                style={{ ...footerStyles, ...footerBlock.style }}
            >
                <Location />
                <Compass />
                {!statsBlock.placed && (
                    <div
                        ref={statsBlock.ref}
                        className={cn('flex gap-3', { 'flex-row-reverse': settings.switchPlayerStatsPosition })}
                        style={statsBlock.style}
                    >
                        <PlayerStats />
                        <PetStats />
                    </div>
                )}
            </animated.div>

            {statsBlock.placed && (
                <div ref={statsBlock.ref} className="absolute flex gap-3 text-white h-fit" style={statsBlock.style}>
                    <PlayerStats />
                    <PetStats />
                </div>
            )}
        </>
    );
};
