import { JobRegistry } from '../job/config';
import { Err, Ok, Result } from '../result';

export const PLATE_REGEX = /^[A-Z0-9]{2,8}$/;

export type CustomPlateVehicle = {
    id: number;
    label: string;
    plate: string;
    price: number;
};

export type CustomPlateMenuData = {
    vehicles: CustomPlateVehicle[];
};

const RESERVED_PLATE_PREFIXES: string[] = [
    ...Object.values(JobRegistry)
        .map(job => job.platePrefix?.trim())
        .filter((prefix): prefix is string => !!prefix),
    'LUXE',
    'ESSAI',
];

export const validateCustomPlate: (input: string) => Result<string, string> = input => {
    const plate = input?.trim().toUpperCase();

    if (!plate || !PLATE_REGEX.test(plate)) {
        return Err('La plaque doit contenir entre 2 et 8 lettres/chiffres, sans espace ni caractère spécial.');
    }

    if (RESERVED_PLATE_PREFIXES.some(prefix => plate.startsWith(prefix))) {
        return Err('Cette plaque est réservée, veuillez en choisir une autre.');
    }

    return Ok(plate);
};
