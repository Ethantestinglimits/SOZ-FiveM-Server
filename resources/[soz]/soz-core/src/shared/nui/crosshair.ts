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

export type CrosshairProfile = {
    id: string;
    name: string;
    config: CrosshairConfig;
};

export type CrosshairProfiles = {
    active: string;
    profiles: CrosshairProfile[];
};

export const MAX_CROSSHAIR_PROFILES = 10;
export const CROSSHAIR_NAME_MAX = 24;

const SHARE_PREFIX = 'SOZ1-';
const SHARE_LENGTH = 16;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

const sanitizeLines = (lines: Partial<CrosshairLines> | undefined, fallback: CrosshairLines): CrosshairLines => ({
    enabled: Boolean(lines?.enabled ?? fallback.enabled),
    opacity: clamp(lines?.opacity, 0, 100, fallback.opacity),
    length: clamp(lines?.length, 1, 30, fallback.length),
    thickness: clamp(lines?.thickness, 1, 8, fallback.thickness),
    gap: clamp(lines?.gap, 0, 40, fallback.gap),
});

export const sanitizeCrosshair = (input: Partial<CrosshairConfig> | null | undefined): CrosshairConfig => ({
    customized: Boolean(input?.customized),
    color:
        typeof input?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color)
            ? input.color
            : DEFAULT_CROSSHAIR.color,
    outline: {
        enabled: Boolean(input?.outline?.enabled ?? DEFAULT_CROSSHAIR.outline.enabled),
        opacity: clamp(input?.outline?.opacity, 0, 100, DEFAULT_CROSSHAIR.outline.opacity),
        thickness: clamp(input?.outline?.thickness, 1, 4, DEFAULT_CROSSHAIR.outline.thickness),
    },
    dot: Boolean(input?.dot),
    inner: sanitizeLines(input?.inner, DEFAULT_CROSSHAIR.inner),
    outer: sanitizeLines(input?.outer, DEFAULT_CROSSHAIR.outer),
    ring: {
        enabled: Boolean(input?.ring?.enabled),
        radius: clamp(input?.ring?.radius, 4, 40, DEFAULT_CROSSHAIR.ring.radius),
        thickness: clamp(input?.ring?.thickness, 1, 8, DEFAULT_CROSSHAIR.ring.thickness),
    },
    tStyle: Boolean(input?.tStyle),
});

export const sanitizeCrosshairProfiles = (input: Partial<CrosshairProfiles> | null | undefined): CrosshairProfiles => {
    const seen = new Set<string>();
    const profiles = (Array.isArray(input?.profiles) ? input.profiles : [])
        .filter(profile => typeof profile?.id === 'string' && profile.id !== '' && !seen.has(profile.id))
        .slice(0, MAX_CROSSHAIR_PROFILES)
        .map((profile, index) => {
            seen.add(profile.id);

            const name = typeof profile.name === 'string' ? profile.name.trim().slice(0, CROSSHAIR_NAME_MAX) : '';

            return { id: profile.id, name: name || `Profil ${index + 1}`, config: sanitizeCrosshair(profile.config) };
        });

    if (profiles.length === 0) {
        profiles.push({ id: 'default', name: 'Mon viseur', config: { ...DEFAULT_CROSSHAIR } });
    }

    return {
        active: profiles.some(profile => profile.id === input?.active) ? input.active : profiles[0].id,
        profiles,
    };
};

const toBase64 = (bytes: number[]): string => {
    let text = '';

    for (let index = 0; index < bytes.length; index += 3) {
        const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
        const size = Math.min(3, bytes.length - index) + 1;

        for (let position = 0; position < size; position++) {
            text += BASE64[(chunk >> (18 - position * 6)) & 63];
        }
    }

    return text;
};

const fromBase64 = (text: string): number[] | null => {
    const values = text.split('').map(character => BASE64.indexOf(character));

    if (values.some(value => value === -1)) {
        return null;
    }

    const bytes: number[] = [];

    for (let index = 0; index < values.length; index += 4) {
        const group = values.slice(index, index + 4);
        const chunk = group.reduce((total, value, position) => total | (value << (18 - position * 6)), 0);

        for (let position = 0; position < group.length - 1; position++) {
            bytes.push((chunk >> (16 - position * 8)) & 255);
        }
    }

    return bytes;
};

export const encodeCrosshair = (config: CrosshairConfig): string => {
    const color = parseInt(config.color.slice(1), 16);
    const flags =
        Number(config.outline.enabled) |
        (Number(config.dot) << 1) |
        (Number(config.inner.enabled) << 2) |
        (Number(config.outer.enabled) << 3) |
        (Number(config.ring.enabled) << 4) |
        (Number(config.tStyle) << 5);

    return (
        SHARE_PREFIX +
        toBase64([
            (color >> 16) & 255,
            (color >> 8) & 255,
            color & 255,
            flags,
            config.outline.opacity,
            config.outline.thickness,
            config.inner.opacity,
            config.inner.length,
            config.inner.thickness,
            config.inner.gap,
            config.outer.opacity,
            config.outer.length,
            config.outer.thickness,
            config.outer.gap,
            config.ring.radius,
            config.ring.thickness,
        ])
    );
};

export const decodeCrosshair = (code: string): CrosshairConfig | null => {
    const text = code.replace(/\s+/g, '');

    if (!text.toUpperCase().startsWith(SHARE_PREFIX)) {
        return null;
    }

    const bytes = fromBase64(text.slice(SHARE_PREFIX.length));

    if (!bytes || bytes.length !== SHARE_LENGTH) {
        return null;
    }

    const [r, g, b, flags, ...values] = bytes;
    const flag = (bit: number) => Boolean(flags & (1 << bit));

    return sanitizeCrosshair({
        customized: true,
        color: `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`,
        outline: { enabled: flag(0), opacity: values[0], thickness: values[1] },
        dot: flag(1),
        inner: { enabled: flag(2), opacity: values[2], length: values[3], thickness: values[4], gap: values[5] },
        outer: { enabled: flag(3), opacity: values[6], length: values[7], thickness: values[8], gap: values[9] },
        ring: { enabled: flag(4), radius: values[10], thickness: values[11] },
        tStyle: flag(5),
    });
};

export interface NuiCrosshairMethodMap {
    Config: CrosshairConfig;
    Visible: boolean;
}
