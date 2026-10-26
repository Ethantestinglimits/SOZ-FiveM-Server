import { useEffect, useState } from 'react';

import { HudLayout } from '../../../shared/nui/hud_layout';

let layout: HudLayout = {};
const listeners = new Set<(layout: HudLayout) => void>();

export const setHudLayout = (next: HudLayout): void => {
    layout = next;
    listeners.forEach((listener) => listener(next));
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
