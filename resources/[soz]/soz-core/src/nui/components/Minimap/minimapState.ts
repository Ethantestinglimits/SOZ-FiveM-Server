import { useEffect, useState } from 'react';

export type MinimapMode = 'minimap' | 'opening' | 'open' | 'closing';

let mode: MinimapMode = 'minimap';
let mapTabActive = true;
const listeners = new Set<(mode: MinimapMode) => void>();

export const minimapController: { requestClose: (() => boolean) | null } = { requestClose: null };

export const setMinimapMode = (next: MinimapMode): void => {
    mode = next;
    listeners.forEach(listener => listener(next));
};

export const getMinimapMode = (): MinimapMode => mode;

export const setMapTabActive = (value: boolean): void => {
    mapTabActive = value;
};

export const isMapTabActive = (): boolean => mapTabActive;

export const useMinimapMode = (): MinimapMode => {
    const [current, setCurrent] = useState(mode);

    useEffect(() => {
        listeners.add(setCurrent);
        setCurrent(mode);

        return () => {
            listeners.delete(setCurrent);
        };
    }, []);

    return current;
};
