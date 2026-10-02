import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';

import { useHudHasStreetNames } from '../../hook/data';
import { RootState } from '../../store';
import { GlassMorphismBox } from '../Styleguide/GlassMorphismBox';
import { Compass } from './components/Compass';
import { DateTime } from './components/DateTime';
import { Location } from './components/Location';
import { PetStats } from './components/PetStats';
import { PlayerStats } from './components/PlayerStats';
import { VoiceIcon } from './components/VoiceIcon';
import { Weather } from './components/Weather';
import { useVoiceIcon } from './hooks/useVoiceIcon';

export const WatchInterface: FunctionComponent = () => {
    const hasWatch = useSelector((state: RootState) => state.hud.hasWatch);
    const settings = useSelector((state: RootState) => state.hud.settings);
    const minimap = useSelector((state: RootState) => state.hud.minimap);

    const hasStreetNamesEnabled = useHudHasStreetNames();

    const [voiceIcon, disableAutoHide] = useVoiceIcon();

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

    return (
        <>
            <animated.div
                className={cn('absolute flex justify-between items-end text-white', {
                    'px-5': minimap.isHidden,
                })}
                style={headerStyles}
            >
                <DateTime />
                <Weather />
            </animated.div>

            {hasWatch && !minimap.isHidden && (
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
                style={voiceStyles}
            >
                <VoiceIcon icon={voiceIcon} disableAutoHide={disableAutoHide} />
            </animated.div>

            <animated.div
                className={cn('absolute flex gap-3 text-white h-fit', {
                    '-mt-14': !hasStreetNamesEnabled,
                    'flex-row-reverse': settings.switchPlayerStatsPosition,
                })}
                style={footerStyles}
            >
                <Location />
                <Compass />
                <PlayerStats />
                <PetStats />
            </animated.div>
        </>
    );
};
