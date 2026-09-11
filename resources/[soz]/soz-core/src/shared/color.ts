export type RGBColor = [number, number, number];
export type RGBAColor = [number, number, number, number];

export type HSLColor = [number, number, number];
export type HSVColor = [number, number, number];

export const rgbToHsl = (rgb: RGBColor): HSLColor => {
    const [r, g, b] = rgb.map(x => x / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;
    let h: number, s: number;

    if (delta === 0) {
        h = s = 0; // achromatic
    } else {
        s = l < 0.5 ? delta / (max + min) : delta / (2 - max - min);
        switch (max) {
            case r:
                h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
                break;
            case g:
                h = ((b - r) / delta + 2) * 60;
                break;
            case b:
                h = ((r - g) / delta + 4) * 60;
                break;
        }
    }

    return [h, s * 100, l * 100];
};

export const hslToRgb = (hsl: HSLColor): RGBColor => {
    const [h, s, l] = hsl.map(x => x / 100);
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hueToRgb = (t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        r = hueToRgb(h + 1 / 3);
        g = hueToRgb(h);
        b = hueToRgb(h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

export const rgbToHsv = (rgb: RGBColor): HSVColor => {
    const [r, g, b] = rgb.map(x => x / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;

    if (delta !== 0) {
        switch (max) {
            case r:
                h = ((g - b) / delta) % 6;
                break;
            case g:
                h = (b - r) / delta + 2;
                break;
            case b:
                h = (r - g) / delta + 4;
                break;
        }

        h *= 60;
        if (h < 0) {
            h += 360;
        }
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return [h, s * 100, v * 100];
};

export const hsvToRgb = (hsv: HSVColor): RGBColor => {
    const h = hsv[0];
    const s = hsv[1] / 100;
    const v = hsv[2] / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let [r, g, b] = [0, 0, 0];

    if (h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

export const rgbToHex = (rgb: RGBColor): string =>
    '#' +
    rgb
        .map(channel =>
            Math.max(0, Math.min(255, Math.round(channel)))
                .toString(16)
                .padStart(2, '0')
        )
        .join('');

export const hexToRgb = (hex: string): RGBColor | null => {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());

    if (!match) {
        return null;
    }

    const value = parseInt(match[1], 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};
