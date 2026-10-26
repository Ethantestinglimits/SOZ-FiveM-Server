import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { NuiEvent } from '../../../shared/event/nui';
import { Progress } from '../../../shared/nui/progress';
import { fetchNui } from '../../fetch';
import { useHudHasStreetNames, useHudMinimap, useVehicle } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { RootState } from '../../store';
import { useHudColor } from '../Hud/hooks/useHudColor';
import { layoutTransform, useHudLayout } from '../Hud/hudLayoutState';
import { GameCanvasBox } from '../Styleguide/GameCanvasBox';
import { GlassMorphismContainer } from '../Styleguide/GlassMorphismContainer';

const PROGRESS_BAR_SEGMENTS = 10;

type ProgressContentProps = {
    progress: Progress;
    currentProgress: number;
    inVehicle: boolean;
};

export const ProgressContent: FunctionComponent<ProgressContentProps> = ({ progress, currentProgress, inVehicle }) => (
    <>
        {!progress?.hideBar && (
            <div className="flex justify-center items-center">
                <GameCanvasBox borderClassName="flex items-center gap-2" blur={false}>
                    {Array.from({ length: PROGRESS_BAR_SEGMENTS }, (_, index) => (
                        <ProgressSegment
                            key={index}
                            currentSegment={index}
                            maxSegment={PROGRESS_BAR_SEGMENTS}
                            progress={progress}
                            currentProgress={currentProgress}
                        />
                    ))}
                </GameCanvasBox>
            </div>
        )}

        {!inVehicle && (progress?.label || progress?.units?.length > 0) && (
            <div className="flex justify-center items-center gap-2">
                <GlassMorphismContainer
                    className="flex gap-10 px-5 py-1 w-fit"
                    borderClassName="rounded-full"
                    borderColor={progress?.color}
                    disableGameClone={!progress}
                >
                    <span>{progress?.label}</span>

                    {progress?.units?.length > 0 && (
                        <div className="flex gap-2">
                            {progress?.units.map((unit, index) => (
                                <div key={index} className="font-mono font-sm w-18">
                                    {((unit.end - unit.start) * currentProgress + unit.start).toFixed(2)}
                                    {unit.unit}
                                </div>
                            ))}
                        </div>
                    )}
                </GlassMorphismContainer>
            </div>
        )}
    </>
);

export const ProgressApp: FunctionComponent = () => {
    const minimap = useHudMinimap();
    const layout = useHudLayout().progress;
    const vehicle = useVehicle();
    const hasStreetNamesEnabled = useHudHasStreetNames();

    const [progress, setProgress] = useState<Progress | null>();
    const [currentProgress, setCurrentProgress] = useState(0);

    const styles = useSpring({
        from: {
            opacity: 0,
            top: '150vh',
        },
        to: {
            opacity: progress ? 1 : 0,
            top: progress ? (layout ? `${layout.y}vh` : `${(minimap.bottom + 0.005) * 100}vh`) : '150vh',
            ...(layout ? { left: `${layout.x}vw` } : { right: `${(minimap.left + 0.005) * 100}vw` }),
        },
    });

    useNuiEvent('progress', 'Start', data => {
        setCurrentProgress(0);
        setProgress(data);
    });

    useNuiEvent('progress', 'Stop', () => {
        setCurrentProgress(0);
        setProgress(null);
    });

    useEffect(() => {
        if (!progress) {
            return () => {};
        }

        const end = Date.now() + progress.duration;
        const timer = setInterval(() => {
            if (Date.now() > end) {
                setProgress(null);
                return;
            }

            const diff = end - Date.now();
            const completedPercentage = 1 - diff / progress.duration;

            setCurrentProgress(completedPercentage);
        }, 20);

        return () => {
            clearInterval(timer);
        };
    }, [progress]);

    useEffect(() => {
        if (currentProgress >= 1) {
            fetchNui(NuiEvent.ProgressFinish);
        }
    }, [currentProgress]);

    if (!progress) {
        return null;
    }

    return (
        <animated.div
            style={{
                ...styles,
                ...(layout ? layoutTransform(layout, 'top center', 'translateX(-50%)') : {}),
            }}
            className={cn(
                `absolute flex flex-col justify-center items-center gap-3 text-white text-xl`,
                layout ? 'w-fit' : 'w-full inset-x-0',
                {
                    'bottom-10': !layout && hasStreetNamesEnabled && vehicle.seat === null,
                    '-bottom-10': !layout && hasStreetNamesEnabled && vehicle.seat !== null,
                    '-mt-16': !layout && !hasStreetNamesEnabled && vehicle.seat === null,
                    '-mt-0': !layout && !hasStreetNamesEnabled && vehicle.seat !== null,
                }
            )}
        >
            <ProgressContent progress={progress} currentProgress={currentProgress} inVehicle={vehicle.seat !== null} />
        </animated.div>
    );
};

interface ProgressSegmentProps {
    currentSegment: number;
    maxSegment: number;
    progress: Progress;
    currentProgress: number;
}

export const ProgressSegment: FunctionComponent<ProgressSegmentProps> = ({
    currentSegment,
    maxSegment,
    progress,
    currentProgress,
}) => {
    const { glassmorphismColors } = useHudColor();
    const glassmorphism = useSelector((state: RootState) => state.hud.useGlassmorphism);

    const sectionMax = progress?.duration / maxSegment;
    const progressForSection = currentProgress * progress?.duration - sectionMax * currentSegment;
    const barPercentage = Math.min(100, (Math.max(0, progressForSection) / sectionMax) * 100);

    return (
        <div className="w-10 rounded-md overflow-hidden">
            <div
                className={cn('relative', {
                    'backdrop-blur-[5px]': glassmorphism,
                })}
            >
                <div
                    className="absolute inset-0"
                    style={{
                        background: glassmorphismColors.background,
                    }}
                />
                <div
                    className="relative h-2.5 rounded-md z-10"
                    style={{ width: `${barPercentage}%`, background: glassmorphismColors.border }}
                />
            </div>
        </div>
    );
};
