import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { FunctionComponent, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { VoiceMode } from '../../../shared/hud';
import { DEFAULT_MINIMAP_STYLE } from '../../../shared/nui/hud_layout';
import { useHudHasStreetNames, useHudMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { RootState } from '../../store';
import { useMinimapMode } from '../Minimap/minimapState';
import { GlassMorphismBox } from '../Styleguide/GlassMorphismBox';
import { Compass } from './components/Compass';
import { DateTime } from './components/DateTime';
import { Location } from './components/Location';
import { PetStats } from './components/PetStats';
import { PlayerStats } from './components/PlayerStats';
import { VoiceIcon } from './components/VoiceIcon';
import { Weather } from './components/Weather';
import { useHudColor } from './hooks/useHudColor';
import { layoutTransform, useHudLayout } from './hudLayoutState';
import { LayoutBlock } from './LayoutBlock';

export const WatchInterface: FunctionComponent = () => {
    const hasWatch = useSelector((state: RootState) => state.hud.hasWatch);
    const settings = useSelector((state: RootState) => state.hud.settings);
    const minimap = useHudMinimap();
    const layout = useHudLayout();
    const statsLayout = layout.stats;
    const minimapStyle = layout.minimapStyle ?? DEFAULT_MINIMAP_STYLE;
    const frameVisible =
        minimapStyle.frame === 'visible' || (minimapStyle.frame === 'auto' && minimapStyle.shape === 'rectangle');

    const hasStreetNamesEnabled = useHudHasStreetNames();
    const minimapMode = useMinimapMode();

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

    const statsStyles = useSpring({
        from: {
            top: '150vh',
        },
        to: {
            top: `${statsLayout?.y ?? 0}vh`,
            left: `${statsLayout?.x ?? 0}vw`,
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

    return (
        <>
            {(!layout.datetime || !layout.weather) && (
                <animated.div
                    className={cn('absolute flex justify-between items-end text-white', {
                        'px-5': minimap.isHidden,
                    })}
                    style={headerStyles}
                >
                    {layout.datetime ? <span /> : <DateTime />}
                    {!layout.weather && <Weather />}
                </animated.div>
            )}

            {layout.datetime && (
                <LayoutBlock position={layout.datetime} anchor="bottom-left" className="flex items-end text-white">
                    <DateTime />
                </LayoutBlock>
            )}

            {layout.weather && (
                <LayoutBlock position={layout.weather} anchor="bottom-right" className="flex items-end text-white">
                    <Weather />
                </LayoutBlock>
            )}

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

            {layout.voice ? (
                <LayoutBlock position={layout.voice} anchor="bottom-left" className="size-12 drop-shadow-bg">
                    <VoiceIcon icon={voiceIcon} disableAutoHide={disableAutoHide} />
                </LayoutBlock>
            ) : (
                <animated.div
                    className={cn('absolute size-12 drop-shadow-bg ml-3', {
                        'mb-14': !hasStreetNamesEnabled,
                    })}
                    style={voiceStyles}
                >
                    <VoiceIcon icon={voiceIcon} disableAutoHide={disableAutoHide} />
                </animated.div>
            )}

            <animated.div
                className={cn('absolute flex gap-3 text-white h-fit', {
                    '-mt-14': !hasStreetNamesEnabled,
                    'flex-row-reverse': settings.switchPlayerStatsPosition,
                })}
                style={footerStyles}
            >
                {!layout.street && <Location />}
                {!layout.compass && <Compass />}
                {!statsLayout && (
                    <>
                        <PlayerStats />
                        <PetStats />
                    </>
                )}
            </animated.div>

            {layout.street && (
                <LayoutBlock position={layout.street} anchor="top-left" className="text-white">
                    <Location />
                </LayoutBlock>
            )}

            {layout.compass && (
                <LayoutBlock position={layout.compass} anchor="top-left" className="text-white">
                    <Compass />
                </LayoutBlock>
            )}

            {statsLayout && (
                <animated.div
                    className="absolute flex gap-3 text-white h-fit"
                    style={{ ...statsStyles, ...layoutTransform(statsLayout, 'top left') }}
                >
                    <PlayerStats />
                    <PetStats />
                </animated.div>
            )}
        </>
    );
};
