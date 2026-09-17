import { Vector4 } from './polyzone/vector';
import { ProgressAnimation, ProgressProp } from './progress';

// Stock GTA V prop used as a placeholder placement/interaction anchor for graffiti tags.
// Swap for a custom prop once one is available, no other code needs to change.
export const GRAFFITI_ANCHOR_MODEL = 'p_cs_spray_can_s';

export const GRAFFITI_ITEM = 'soz_graffiti_tag';

export const GRAFFITI_WIDTH = 1.6;
export const GRAFFITI_HEIGHT = 1.2;

export const GRAFFITI_MAX_PER_GANG = 5;

export const GRAFFITI_TEXTURE_DICT = 'dynamic_prop_textures';

export const GRAFFITI_PLACE_DURATION = 10000;
export const GRAFFITI_CLEAN_DURATION = 5000;

// No dedicated tag/spray animation exists in this codebase, so this reuses the generic
// "handiwork" loop already proven for the billboard placement, with the spray can prop attached
// to the hand to sell the visual. Swap the dictionary/name for a real tagging animation if one
// becomes available - nothing else needs to change.
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

// Dedicated contact NPC for gangs to manage their own placed graffitis (list + remove), since the
// real gang business/storage NPC isn't part of this checkout (it lives in the private overlay).
// Both the model and the spawn point below are placeholders - move/reskin freely, no other code
// needs to change.
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
