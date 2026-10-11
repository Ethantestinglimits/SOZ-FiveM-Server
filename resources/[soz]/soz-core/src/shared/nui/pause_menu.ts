export type PauseMapLayer = 'postals' | 'regions' | 'blips';

export type PauseMapSettings = {
    layers: PauseMapLayer[];
};

export type PauseMapPoint = {
    x: number;
    y: number;
};

export type PauseMapPlayer = PauseMapPoint & {
    heading: number;
};

export type PauseMapBlip = PauseMapPoint & {
    id: string;
    name: string | null;
    sprite: number;
    color: number;
    scale: number;
};

export type PauseMapZone = PauseMapPoint & {
    id: string;
    radius: number;
    color: number;
    alpha: number;
};

export type PauseMapRegion = PauseMapPoint & {
    name: string;
    weight: number;
};

export type PauseMenuData = {
    firstname: string;
    lastname: string;
    job: string | null;
    grade: string | null;
    onDuty: boolean;
    serverId: number;
    player: PauseMapPlayer;
    waypoint: PauseMapPoint | null;
    route: PauseMapPoint[];
    blips: PauseMapBlip[];
    zones: PauseMapZone[];
    regions: PauseMapRegion[];
    settings: PauseMapSettings;
};

export interface NuiPauseMenuMethodMap {
    Open: PauseMenuData;
    Close: never;
    SetPlayer: PauseMapPlayer;
    SetWaypoint: PauseMapPoint | null;
    SetRoute: PauseMapPoint[];
}
