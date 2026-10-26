import { useEffect, useState } from 'react';

export type MenuStyle = {
    size: number;
    text: number;
    potato: boolean;
};

const TEXT_SCALES = [0.85, 0.92, 1, 1.12, 1.25];

let style: MenuStyle = { size: 100, text: 3, potato: false };
const listeners = new Set<(style: MenuStyle) => void>();

export const setMenuStyle = (next: MenuStyle): void => {
    style = next;
    listeners.forEach(listener => listener(next));
};

export const getTextScale = (level: number): number => TEXT_SCALES[Math.min(TEXT_SCALES.length, Math.max(1, level)) - 1];

export const useMenuStyle = (): MenuStyle => {
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
