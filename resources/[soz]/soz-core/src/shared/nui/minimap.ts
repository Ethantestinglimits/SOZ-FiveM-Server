export type MinimapOrientation = 'camera' | 'upright' | 'north';

export const MINIMAP_ORIENTATIONS: MinimapOrientation[] = ['camera', 'upright', 'north'];

export type MinimapShape = 'rectangle' | 'square' | 'circle';

export type MinimapFrameMode = 'auto' | 'visible' | 'hidden';

export type MinimapTiltMode = 'none' | 'vehicle' | 'fixed' | 'camera';

export type MinimapStyle = {
    shape: MinimapShape;
    radius?: number;
    opacity: number;
    borderWidth: number;
    borderColor: string;
    frame: MinimapFrameMode;
    tiltMode?: MinimapTiltMode;
    tilt?: number;
    tiltArrow?: boolean;
    zoom?: number;
};

export const MINIMAP_SHAPES: MinimapShape[] = ['rectangle', 'square', 'circle'];

export const MINIMAP_FRAME_MODES: MinimapFrameMode[] = ['auto', 'visible', 'hidden'];

export const MINIMAP_OPACITY_MIN = 20;
export const MINIMAP_BORDER_MAX = 6;
export const MINIMAP_RADIUS_MAX = 50;
export const MINIMAP_TILT_MAX = 75;
export const MINIMAP_ZOOM_MIN = 50;
export const MINIMAP_ZOOM_MAX = 200;
export const MINIMAP_ZOOM_DEFAULT = 85;
export const MINIMAP_TILT_DEFAULT = 57;
export const MINIMAP_TILT_MODES: MinimapTiltMode[] = ['none', 'vehicle', 'fixed', 'camera'];

export const DEFAULT_MINIMAP_STYLE: MinimapStyle = {
    shape: 'rectangle',
    opacity: 100,
    borderWidth: 0,
    borderColor: '#ffffff',
    frame: 'auto',
    tiltMode: 'vehicle',
    tilt: MINIMAP_TILT_DEFAULT,
    tiltArrow: false,
    zoom: MINIMAP_ZOOM_DEFAULT,
};

export type MinimapPoint = {
    x: number;
    y: number;
};

export type MinimapFrame = MinimapPoint & {
    heading: number;
    camHeading: number;
    camPitch?: number;
    inVehicle?: boolean;
    speed: number;
    altitude: number;
    visible: boolean;
};

export type MinimapBlip = MinimapPoint & {
    id?: string;
    name?: string;
    actions?: boolean;
    player?: boolean;
    group?: MinimapPlayerGroup;
    alpha: number;
    sprite: number;
    color: number;
    rotation: number;
};

export type MinimapPlayerGroup = {
    id: string;
    label: string;
    order: number;
};

export type PlayersLayerLayout = {
    collapsed: boolean;
    expanded: string[];
};

export type PlayersLayerState = {
    allowed: boolean;
    enabled: boolean;
    layout: PlayersLayerLayout;
};

export type MinimapPlayerBlip = MinimapPoint & {
    id: string;
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
    PlayerBlips: MinimapPlayerBlip[];
    Zones: MinimapZone[];
    Route: MinimapPoint[];
    Waypoint: MinimapPoint | null;
    Style: MinimapStyle;
    Settings: { animation: boolean; fps: number; potato: boolean; orientation: MinimapOrientation };
}
