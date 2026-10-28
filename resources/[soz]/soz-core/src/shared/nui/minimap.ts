export type MinimapOrientation = 'camera' | 'upright' | 'north';

export const MINIMAP_ORIENTATIONS: MinimapOrientation[] = ['camera', 'upright', 'north'];

export type MinimapShape = 'rectangle' | 'square' | 'circle';

export type MinimapFrameMode = 'auto' | 'visible' | 'hidden';

export type MinimapStyle = {
    shape: MinimapShape;
    radius?: number;
    opacity: number;
    borderWidth: number;
    borderColor: string;
    frame: MinimapFrameMode;
};

export const MINIMAP_SHAPES: MinimapShape[] = ['rectangle', 'square', 'circle'];

export const MINIMAP_FRAME_MODES: MinimapFrameMode[] = ['auto', 'visible', 'hidden'];

export const MINIMAP_OPACITY_MIN = 20;
export const MINIMAP_BORDER_MAX = 6;
export const MINIMAP_RADIUS_MAX = 50;

export const DEFAULT_MINIMAP_STYLE: MinimapStyle = {
    shape: 'rectangle',
    opacity: 100,
    borderWidth: 0,
    borderColor: '#ffffff',
    frame: 'auto',
};

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
    id?: string;
    name?: string;
    actions?: boolean;
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
    Style: MinimapStyle;
    Settings: { animation: boolean; fps: number; potato: boolean; orientation: MinimapOrientation };
}
