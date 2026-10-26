export type CrosshairLines = {
    enabled: boolean;
    opacity: number;
    length: number;
    thickness: number;
    gap: number;
};

export type CrosshairConfig = {
    customized: boolean;
    color: string;
    outline: { enabled: boolean; opacity: number; thickness: number };
    dot: boolean;
    inner: CrosshairLines;
    outer: CrosshairLines;
    ring: { enabled: boolean; radius: number; thickness: number };
    tStyle: boolean;
};

export const DEFAULT_CROSSHAIR: CrosshairConfig = {
    customized: false,
    color: '#33ff33',
    outline: { enabled: true, opacity: 50, thickness: 1 },
    dot: false,
    inner: { enabled: true, opacity: 100, length: 6, thickness: 2, gap: 3 },
    outer: { enabled: false, opacity: 60, length: 4, thickness: 2, gap: 12 },
    ring: { enabled: false, radius: 14, thickness: 2 },
    tStyle: false,
};

const preset = (changes: Partial<CrosshairConfig>): CrosshairConfig => ({
    ...DEFAULT_CROSSHAIR,
    customized: true,
    ...changes,
});

export const CROSSHAIR_PRESETS: { id: string; label: string; config: CrosshairConfig }[] = [
    { id: 'classic', label: 'Classique', config: preset({}) },
    {
        id: 'precision',
        label: 'Précision',
        config: preset({
            color: '#ffffff',
            dot: true,
            inner: { enabled: true, opacity: 100, length: 4, thickness: 1, gap: 4 },
        }),
    },
    {
        id: 'dot',
        label: 'Point',
        config: preset({
            color: '#ffffff',
            dot: true,
            inner: { ...DEFAULT_CROSSHAIR.inner, enabled: false },
        }),
    },
    {
        id: 'circle',
        label: 'Cercle',
        config: preset({
            color: '#ffffff',
            dot: true,
            inner: { ...DEFAULT_CROSSHAIR.inner, enabled: false },
            ring: { enabled: true, radius: 12, thickness: 2 },
        }),
    },
    {
        id: 'tee',
        label: 'T',
        config: preset({
            tStyle: true,
            inner: { enabled: true, opacity: 100, length: 8, thickness: 2, gap: 2 },
        }),
    },
    {
        id: 'minimal',
        label: 'Minimaliste',
        config: preset({
            color: '#ffffff',
            outline: { enabled: false, opacity: 0, thickness: 1 },
            inner: { enabled: true, opacity: 80, length: 3, thickness: 1, gap: 6 },
        }),
    },
];

export const CROSSHAIR_COLORS = [
    '#ffffff',
    '#33ff33',
    '#99e600',
    '#00e5ff',
    '#ffd400',
    '#ff9500',
    '#ff2a2a',
    '#ff7aa8',
    '#ff1fa6',
    '#9b3cd6',
];

export interface NuiCrosshairMethodMap {
    Config: CrosshairConfig;
    Visible: boolean;
}
