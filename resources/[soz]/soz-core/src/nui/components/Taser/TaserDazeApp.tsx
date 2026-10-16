import { TaserConfig } from '@public/config/taser';
import { useNuiEvent } from '@public/nui/hook/nui';
import { FunctionComponent, useEffect, useState } from 'react';

const YELLOW_VIGNETTE =
    'radial-gradient(ellipse at center, rgba(255,220,90,0) 40%, rgba(255,215,80,0.35) 72%, rgba(255,200,60,0.8) 100%)';

const BLUE_VIGNETTE =
    'radial-gradient(ellipse at center, rgba(90,160,255,0) 40%, rgba(80,150,255,0.35) 72%, rgba(60,120,255,0.8) 100%)';

export const TaserDazeApp: FunctionComponent = () => {
    const [intensity, setIntensity] = useState<number>(0);
    const [phase, setPhase] = useState<number>(0);

    useNuiEvent('taser', 'setDazeIntensity', setIntensity);

    useEffect(() => {
        if (intensity <= 0) {
            return;
        }

        let frame: number;

        const animate = (time: number) => {
            setPhase((Math.sin((time / TaserConfig.visual.tintCycleMs) * 2 * Math.PI) + 1) / 2);
            frame = requestAnimationFrame(animate);
        };

        frame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frame);
    }, [intensity > 0]);

    if (intensity <= 0) {
        return null;
    }

    const opacity = intensity * TaserConfig.visual.maxVignetteOpacity;

    return (
        <div className="fixed inset-0 pointer-events-none">
            <div className="absolute inset-0" style={{ background: YELLOW_VIGNETTE, opacity: opacity * phase }} />
            <div className="absolute inset-0" style={{ background: BLUE_VIGNETTE, opacity: opacity * (1 - phase) }} />
        </div>
    );
};
