import { useEffect, useState } from 'react';

let hovered = false;
const listeners = new Set<(hovered: boolean) => void>();

export const setNativeHover = (next: boolean): void => {
    if (hovered === next) {
        return;
    }

    hovered = next;
    listeners.forEach((listener) => listener(next));
};

export const useNativeHover = (): boolean => {
    const [current, setCurrent] = useState(hovered);

    useEffect(() => {
        listeners.add(setCurrent);
        setCurrent(hovered);

        return () => {
            listeners.delete(setCurrent);
        };
    }, []);

    return current;
};

let backdrop = false;
const backdropListeners = new Set<(value: boolean) => void>();

export const setNativeBackdrop = (next: boolean): void => {
    if (backdrop === next) {
        return;
    }

    backdrop = next;
    backdropListeners.forEach((listener) => listener(next));
};

export const useNativeBackdrop = (): boolean => {
    const [current, setCurrent] = useState(backdrop);

    useEffect(() => {
        backdropListeners.add(setCurrent);
        setCurrent(backdrop);

        return () => {
            backdropListeners.delete(setCurrent);
        };
    }, []);

    return current;
};
