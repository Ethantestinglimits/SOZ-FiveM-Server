import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { useHudHasStreetNames, useHudMinimap, usePlayer } from '../../hook/data';
import { RootState } from '../../store';
import { FuelGauge } from './components/FuelGauge';
import { LightIndicator } from './components/LightIndicator';
import { LockIndicator } from './components/LockIndicator';
import { NosGauge } from './components/NosGauge';
import { SeatbeltIndicator } from './components/SeatbeltIndicator';
import { SpeedGauge } from './components/SpeedGauge';
import { useHudBlock } from './hudPlacement';

export const VehicleInterface: FunctionComponent = () => {
    const minimap = useHudMinimap();
    const hasStreetNamesEnabled = useHudHasStreetNames();

    const seat = useSelector((state: RootState) => state.vehicle.seat);

    const player = usePlayer();
    const [isPilot, setIsPilot] = useState(false);
    const [timeout, initTimeout] = useState<NodeJS.Timeout>(null);

    const hudShouldBeDisplayed = player && !player.metadata.isdead && seat !== null;

    useEffect(() => {
        clearTimeout(timeout);
        if (seat === null) {
            initTimeout(
                setTimeout(() => {
                    setIsPilot(false);
                }, 1000)
            );
        } else {
            setIsPilot(seat === -1);
        }
    }, [seat]);

    const styles = useSpring({
        from: {
            opacity: 0,
            bottom: '-50vh',
        },
        to: {
            opacity: 1,
            bottom: hudShouldBeDisplayed ? `${100 - minimap.bottom * 100}vh` : '-50vh',
        },
    });

    const block = useHudBlock('vehicle', hudShouldBeDisplayed, { fitContent: true });

    return (
        <animated.div className="absolute inset-x-0 w-full" ref={block.ref} style={{ ...styles, ...block.style }}>
            <div
                ref={block.measureRef}
                className={cn('relative flex justify-center gap-3', {
                    'top-12': hasStreetNamesEnabled,
                })}
            >
                {isPilot ? (
                    <>
                        <div className="flex flex-col justify-end items-end gap-2 w-32">
                            <SeatbeltIndicator />
                            <LockIndicator />
                        </div>
                        <div className="flex justify-center">
                            <NosGauge />
                            <SpeedGauge />
                        </div>
                        <div className="flex flex-col justify-end items-start gap-2 w-32">
                            <LightIndicator />
                            <FuelGauge />
                        </div>
                    </>
                ) : (
                    <div className="flex justify-end items-end pb-[1.25rem]">
                        <SeatbeltIndicator />
                    </div>
                )}
            </div>
        </animated.div>
    );
};
