export type GpsColor = { id: string; label: string; hex: string };

export const GPS_COLORS: GpsColor[] = [
    { id: 'violet', label: 'Violet', hex: '#b25ce8' },
    { id: 'jaune', label: 'Jaune', hex: '#facc15' },
    { id: 'bleu', label: 'Bleu', hex: '#3b82f6' },
    { id: 'vert', label: 'Vert', hex: '#22c55e' },
    { id: 'rouge', label: 'Rouge', hex: '#ef4444' },
    { id: 'orange', label: 'Orange', hex: '#f97316' },
    { id: 'rose', label: 'Rose', hex: '#ec4899' },
    { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
];

export const DEFAULT_GPS_COLOR = GPS_COLORS[0].id;

export const getGpsColor = (id: string | null | undefined): GpsColor =>
    GPS_COLORS.find(color => color.id === id) ?? GPS_COLORS[0];

export type GpsPoint = { x: number; y: number };

export type GpsVehiclePoint = GpsPoint & {
    author: number;
    name: string;
    color: string;
};
