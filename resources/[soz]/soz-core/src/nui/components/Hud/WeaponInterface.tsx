import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';

import { useAssetPath } from '../../hook/assets';
import { useAmmo, useHudHasStreetNames, useHudMinimap } from '../../hook/data';
import { RootState } from '../../store';
import { layoutTransform, useHudLayout } from './hudLayoutState';

export const AmmoContent: FunctionComponent<{ ammo: number; maxAmmo: number }> = ({ ammo, maxAmmo }) => {
    const { getPath } = useAssetPath();

    return (
        <>
            <div className="flex flex-col justify-center items-center tabular-nums h-11">
                <span className="text-3xl leading-7">{ammo}</span>
                <span className="text-xl leading-5 text-white/80 font-light">{maxAmmo}</span>
            </div>
            <img className="size-12 mb-1" src={getPath('images/hud/ammo.webp')} alt="ammo" />
        </>
    );
};

export const WeaponInterface: FunctionComponent = () => {
    const minimap = useHudMinimap();
    const hasStreetNamesEnabled = useHudHasStreetNames();
    const switchPlayerStatsPosition = useSelector((state: RootState) => state.hud.settings.switchPlayerStatsPosition);
    const ammo = useAmmo();
    const layout = useHudLayout().ammo;

    const [ammoStyles] = useSpring(
        () => ({
            from: {
                top: '150vh',
            },
            to: {
                top: ammo.hasWeapon ? (layout ? `${layout.y}vh` : `${(minimap.bottom + 0.005) * 100}vh`) : '150vh',
                right: layout ? `${100 - layout.x}vw` : `${(minimap.left + 0.005) * 100}vw`,
            },
        }),
        [ammo, minimap, layout]
    );

    return (
        <animated.div
            className={cn('absolute flex gap-1 items-center justify-center text-white w-fit drop-shadow-bg', {
                '-mt-14':
                    !layout &&
                    ((!switchPlayerStatsPosition && !hasStreetNamesEnabled) ||
                        (switchPlayerStatsPosition && hasStreetNamesEnabled)),
                '-mt-28': !layout && switchPlayerStatsPosition && !hasStreetNamesEnabled,
            })}
            style={{ ...ammoStyles, ...layoutTransform(layout, 'top right') }}
        >
            <AmmoContent ammo={ammo?.ammo} maxAmmo={ammo?.maxAmmo} />
        </animated.div>
    );
};
