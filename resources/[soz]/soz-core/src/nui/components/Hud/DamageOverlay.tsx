import { useAssetPath } from '@public/nui/hook/assets';
import { animated, useSpring } from '@react-spring/web';
import clsx from 'clsx';
import { useState } from 'react';
import { useSelector } from 'react-redux';

import { PlayerPedHash } from '../../../shared/player';
import { useHudMinimap, usePlayer } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { RootState } from '../../store';
import { layoutTransform, useHudLayout } from './hudLayoutState';

export const InjuryContent = ({ bones }: { bones: string[] }) => {
    const zoomInjuryTracker = useSelector((state: RootState) => state.hud.settings.zoomInjuryTracker);
    const player = usePlayer();
    const { getPath } = useAssetPath();

    const playerType = player?.skin?.Model?.Hash === PlayerPedHash.Male ? 'male' : 'female';

    return (
        <div className="relative h-[30vh]" style={{ zoom: zoomInjuryTracker }}>
            <img
                alt="skel"
                src={getPath(`images/hud/player/damages/${playerType}/skel.webp`)}
                className="h-full top-0 inset-0 opacity-70"
            />

            {bones?.map(bone => (
                <img
                    key={bone}
                    alt={bone}
                    src={getPath(`images/hud/player/damages/${playerType}/${bone}.webp`)}
                    className="absolute h-full top-0 inset-0 opacity-80"
                />
            ))}
        </div>
    );
};

export function DamageOverlay() {
    const hasWatch = useSelector((state: RootState) => state.hud.hasWatch);
    const showInjuryTracker = useSelector((state: RootState) => state.hud.settings.showInjuryTracker);
    const switchInjuryTrackerPosition = useSelector(
        (state: RootState) => state.hud.settings.switchInjuryTrackerPosition
    );
    const minimap = useHudMinimap();
    const layout = useHudLayout().injuries;

    const [bones, setBones] = useState<string[]>([]);

    const shouldDisplay = hasWatch && showInjuryTracker && bones.length > 0;
    const styles = useSpring({
        from: {
            opacity: 0,
        },
        to: {
            opacity: 1,
            top: shouldDisplay ? (layout ? `${layout.y}vh` : '0vh') : '-50vh',
            left: layout ? '0vw' : `${minimap.left * 100}vw`,
            right: layout ? `${100 - layout.x}vw` : `${minimap.left * 100}vw`,
        },
    });

    useNuiEvent('hud', 'SetDamagedBones', setBones);

    return (
        <animated.div
            className={clsx('absolute flex', {
                'top-0 inset-x-0': !layout,
                'justify-start': !layout && switchInjuryTrackerPosition,
                'justify-end': layout || !switchInjuryTrackerPosition,
            })}
            style={{ ...styles, ...layoutTransform(layout, 'top right') }}
        >
            <InjuryContent bones={bones} />
        </animated.div>
    );
}
