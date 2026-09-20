import { Vector4 } from './polyzone/vector';
import { ProgressAnimation, ProgressProp } from './progress';

export const GRAFFITI_ANCHOR_MODEL = 'prop_paint_spray01a';

export const GRAFFITI_ITEM = 'soz_graffiti_tag';

export const GRAFFITI_WIDTH = 1.6;
export const GRAFFITI_HEIGHT = 1.2;

export const GRAFFITI_MAX_PER_GANG = 5;

export const GRAFFITI_TEXTURE_DICT = 'dynamic_prop_textures';

export const GRAFFITI_PLACE_DURATION = 10000;
export const GRAFFITI_CLEAN_DURATION = 5000;

export const GRAFFITI_TAG_ANIMATION: ProgressAnimation = {
    dictionary: 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@',
    name: 'machinic_loop_mechandplayer',
    options: { onlyUpperBody: true },
};

export const GRAFFITI_SPRAY_CAN_PROP: ProgressProp = {
    model: GRAFFITI_ANCHOR_MODEL,
    bone: 28422,
    coords: { x: 0.0, y: 0.0, z: -0.045 },
    rotation: { x: 0, y: 0, z: 0 },
};

export const GRAFFITI_NPC_MODEL = 'csb_stretch';
export const GRAFFITI_NPC_POSITION: Vector4 = [-190.0, -1602.0, 34.0, 200.0];

export type GraffitiMenuEntry = {
    id: string;
    distanceLabel: string;
    hasImage: boolean;
};

export type GraffitiMenuData = {
    tags: GraffitiMenuEntry[];
};
