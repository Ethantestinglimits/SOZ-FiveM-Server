import { GpsColors } from '../config/gps';

export type GpsColorOption = {
    label: string;
    blipColor: number;
    rgb: [number, number, number];
};

export type GpsPointPosition = [number, number];

export type VehicleGpsPoint = {
    author: number;
    position: GpsPointPosition;
    blipColor: number;
};

export const DefaultGpsColor = GpsColors[0];

export const findGpsColor = (blipColor: unknown): GpsColorOption =>
    GpsColors.find(gpsColor => gpsColor.blipColor === blipColor) ?? DefaultGpsColor;

export const isGpsBlipColor = (blipColor: unknown): blipColor is number =>
    GpsColors.some(gpsColor => gpsColor.blipColor === blipColor);

const GPS_POINT_POSITION_TOLERANCE = 0.5;

export const isSameGpsPointPosition = (a: GpsPointPosition | null, b: GpsPointPosition | null): boolean => {
    if (a === null || b === null) {
        return a === b;
    }

    return Math.abs(a[0] - b[0]) < GPS_POINT_POSITION_TOLERANCE && Math.abs(a[1] - b[1]) < GPS_POINT_POSITION_TOLERANCE;
};
