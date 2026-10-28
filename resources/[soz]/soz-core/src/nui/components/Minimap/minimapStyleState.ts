import { useEffect, useState } from 'react';

import { DEFAULT_MINIMAP_STYLE, MinimapStyle } from '../../../shared/nui/minimap';

let style: MinimapStyle = DEFAULT_MINIMAP_STYLE;
const listeners = new Set<(style: MinimapStyle) => void>();

export const setMinimapStyle = (next: MinimapStyle): void => {
    style = next;
    listeners.forEach((listener) => listener(next));
};

export const getMinimapStyle = (): MinimapStyle => style;

export const useMinimapStyle = (): MinimapStyle => {
    const [current, setCurrent] = useState(style);

    useEffect(() => {
        listeners.add(setCurrent);
        setCurrent(style);

        return () => {
            listeners.delete(setCurrent);
        };
    }, []);

    return current;
};
