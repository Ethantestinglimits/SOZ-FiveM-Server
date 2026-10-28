import { CSSProperties, useEffect, useState } from 'react';

import { HudLayout, HudPosition, MinimapStyle } from '../../../shared/nui/hud_layout';

let layout: HudLayout = {};
const listeners = new Set<(layout: HudLayout) => void>();

export const setHudLayout = (next: HudLayout): void => {
    layout = next;
    listeners.forEach((listener) => listener(next));
};

export const layoutTransform = (position: HudPosition | undefined, origin: string, prefix = ''): CSSProperties => {
    const scale = position?.scale ? `scale(${position.scale})` : '';
    const transform = `${prefix} ${scale}`.trim();

    if (!transform) {
        return {};
    }

    return scale ? { transform, transformOrigin: origin } : { transform };
};

type MinimapBox = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    X: number;
    Y: number;
};

export const applyMinimapLayout = <T extends MinimapBox>(
    minimap: T,
    group?: HudPosition,
    style?: MinimapStyle
): T => {
    const shape = style?.shape ?? 'rectangle';

    if (!group && shape === 'rectangle') {
        return minimap;
    }

    let width = minimap.width;
    let height = minimap.height;

    if (shape !== 'rectangle' && width > 0 && height > 0) {
        const side = Math.min(width * window.innerWidth, height * window.innerHeight);

        width = side / window.innerWidth;
        height = side / window.innerHeight;
    }

    const scale = group?.scale ?? 1;

    width *= scale;
    height *= scale;

    const left = group ? group.x / 100 : minimap.left;
    const bottom = group ? group.y / 100 : minimap.bottom;
    const widthRatio = minimap.width > 0 ? width / minimap.width : 1;
    const heightRatio = minimap.height > 0 ? height / minimap.height : 1;

    return {
        ...minimap,
        left,
        right: left + width,
        top: bottom - height,
        bottom,
        width,
        height,
        X: left + (minimap.X - minimap.left) * widthRatio,
        Y: bottom + (minimap.Y - minimap.bottom) * heightRatio,
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
