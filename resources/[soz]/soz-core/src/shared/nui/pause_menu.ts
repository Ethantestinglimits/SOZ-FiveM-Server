import { PauseSettingsData } from './pause_settings';

export type PauseMapLayer = 'postals' | 'regions' | 'blips';

export type PauseMapPlace = {
    id: string;
    name: string;
    sprite: number;
    color: number;
    x: number;
    y: number;
};

export type PauseMapRegion = {
    name: string;
    x: number;
    y: number;
    weight: number;
};

export type PauseMenuData = {
    firstname: string;
    lastname: string;
    job: string | null;
    grade: string | null;
    onDuty: boolean;
    serverId: number;
    places: PauseMapPlace[];
    regions: PauseMapRegion[];
    layers: PauseMapLayer[];
    settings: PauseSettingsData;
    scriptMode?: boolean;
    focus?: { x: number; y: number };
};

export interface NuiPauseMenuMethodMap {
    Open: PauseMenuData;
    Close: never;
    Settings: PauseSettingsData;
}
