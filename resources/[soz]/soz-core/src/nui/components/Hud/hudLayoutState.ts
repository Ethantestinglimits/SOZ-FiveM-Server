import { useEffect, useState } from 'react';

import { HudLayout, HudPosition } from '../../../shared/nui/hud_layout';

let layout: HudLayout = {};
const listeners = new Set<(layout: HudLayout) => void>();

export const setHudLayout = (next: HudLayout): void => {
    layout = next;
    listeners.forEach((listener) => listener(next));
};

export const shiftMinimap = <T extends { left: number; right: number; top: number; bottom: number; X: number; Y: number }>(
    minimap: T,
    group?: HudPosition
): T => {
    if (!group) {
        return minimap;
    }

    const dx = group.x / 100 - minimap.left;
    const dy = group.y / 100 - minimap.bottom;

    return {
        ...minimap,
        left: minimap.left + dx,
        right: minimap.right + dx,
        X: minimap.X + dx,
        top: minimap.top + dy,
        bottom: minimap.bottom + dy,
        Y: minimap.Y + dy,
    };
};

export const useHudLayout = (): HudLayout => {
    const [current, setCurrent] = useState(layout);

    useEffect(() => {
        listeners.add(setCurrent);
        setCurrent(layout);

        return () => {
            listeners.delete(setCurrent);
        };
    }, []);

    return current;
};
