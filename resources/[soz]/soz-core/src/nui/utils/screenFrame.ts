export const FRAME_RATIO = 16 / 9;

export type ScreenFrame = { x: number; y: number; w: number; h: number };

export const getScreenFrame = (): ScreenFrame => {
    const w = Math.min(window.innerWidth, window.innerHeight * FRAME_RATIO);

    return { x: (window.innerWidth - w) / 2, y: 0, w, h: window.innerHeight };
};

export const screenWidthToPx = (fraction: number): number => fraction * window.innerWidth;

export const pxToScreenWidth = (px: number): number => px / window.innerWidth;
