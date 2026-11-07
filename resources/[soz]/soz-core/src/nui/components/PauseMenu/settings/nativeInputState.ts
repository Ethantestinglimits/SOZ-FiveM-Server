import { useEffect, useState } from 'react';

import { PauseKeyCapture } from '../../../../shared/nui/pause_menu';

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

let keyCapture: PauseKeyCapture = 'idle';
const keyCaptureListeners = new Set<(value: PauseKeyCapture) => void>();

export const setKeyCapture = (next: PauseKeyCapture): void => {
    if (keyCapture === next) {
        return;
    }

    keyCapture = next;
    keyCaptureListeners.forEach((listener) => listener(next));
};

export const useKeyCapture = (): PauseKeyCapture => {
    const [current, setCurrent] = useState(keyCapture);

    useEffect(() => {
        keyCaptureListeners.add(setCurrent);
        setCurrent(keyCapture);

        return () => {
            keyCaptureListeners.delete(setCurrent);
        };
    }, []);

    return current;
};
