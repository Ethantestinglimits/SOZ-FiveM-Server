import { PauseSettingsData } from './pause_settings';

export type PauseMapLayer = 'postals' | 'regions' | 'blips' | 'players';

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
    player?: { x: number; y: number };
    scriptMode?: boolean;
    focus?: { x: number; y: number };
};

export type PauseGraphicsRow = {
    slot: number;
    id: number;
    type: number;
    value: number;
    selectable: boolean;
    label: string;
    options: string[];
    max: number;
};

export interface NuiPauseMenuMethodMap {
    Open: PauseMenuData;
    Close: never;
    Settings: PauseSettingsData;
    NativeValue: { key: string; value: number };
    GraphicsRows: PauseGraphicsRow[];
    GraphicsNative: boolean;
}
