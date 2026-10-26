export type MinimapPoint = {
    x: number;
    y: number;
};

export type MinimapFrame = MinimapPoint & {
    heading: number;
    camHeading: number;
    speed: number;
    altitude: number;
    visible: boolean;
};

export type MinimapBlip = MinimapPoint & {
    sprite: number;
    color: number;
    rotation: number;
};

export type MinimapZone = MinimapPoint & {
    radius: number;
    color: number;
    alpha: number;
};

export interface NuiMinimapMethodMap {
    Frame: MinimapFrame;
    Blips: MinimapBlip[];
    Zones: MinimapZone[];
    Route: MinimapPoint[];
    Waypoint: MinimapPoint | null;
}
