import { useEffect, useState } from 'react';

import { PauseMapLayer } from '../../../shared/nui/pause_menu';

export type MinimapMode = 'minimap' | 'opening' | 'open' | 'closing';

let mode: MinimapMode = 'minimap';
let mapTabActive = true;
const listeners = new Set<(mode: MinimapMode) => void>();

export const minimapController: {
    requestClose: (() => boolean) | null;
    focus: ((point: { x: number; y: number }) => void) | null;
    setLayers: ((layers: PauseMapLayer[]) => void) | null;
} = { requestClose: null, focus: null, setLayers: null };

let blipAnchor: { x: number; y: number } | null = null;

export const setBlipAnchor = (anchor: { x: number; y: number } | null): void => {
    blipAnchor = anchor;
};

export const getBlipAnchor = (): { x: number; y: number } | null => blipAnchor;

export const setMinimapMode = (next: MinimapMode): void => {
    mode = next;
    listeners.forEach(listener => listener(next));
};

export const getMinimapMode = (): MinimapMode => mode;

let editing = false;

export const setMinimapEditing = (value: boolean): void => {
    editing = value;
};

export const isMinimapEditing = (): boolean => editing;

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
