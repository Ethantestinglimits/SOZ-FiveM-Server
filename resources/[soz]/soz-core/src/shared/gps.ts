import { GpsColors } from '../config/gps';

export type GpsColorOption = {
    label: string;
    blipColor: number;
    rgb: [number, number, number];
};

export const DefaultGpsColor = GpsColors[0];

export const findGpsColor = (blipColor: unknown): GpsColorOption =>
    GpsColors.find(gpsColor => gpsColor.blipColor === blipColor) ?? DefaultGpsColor;

export const isGpsBlipColor = (blipColor: unknown): blipColor is number =>
    GpsColors.some(gpsColor => gpsColor.blipColor === blipColor);
