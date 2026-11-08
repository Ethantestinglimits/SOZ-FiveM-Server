export type HudElementId =
    | 'minimap'
    | 'notifications'
    | 'police'
    | 'instructions'
    | 'ammo'
    | 'stats'
    | 'vehicle'
    | 'progress'
    | 'datetime'
    | 'weather'
    | 'street'
    | 'compass'
    | 'voice'
    | 'injuries';

export const HUD_SCALE_MIN = 0.5;
export const HUD_SCALE_MAX = 2;

export type HudCorner =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

export const HUD_CORNERS: HudCorner[] = [
    'top-left',
    'top',
    'top-right',
    'left',
    'center',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right',
];

export type HudEnter = 'left' | 'right' | 'fade';

export const HUD_ENTERS: HudEnter[] = ['left', 'right', 'fade'];

export type HudAnchorTarget = 'frame' | 'screen' | HudElementId;

export type HudPlacement = {
    target: HudAnchorTarget;
    targetCorner: HudCorner;
    corner: HudCorner;
    x: number;
    y: number;
    scale?: number;
    hidden?: boolean;
    enter?: HudEnter;
};

export type HudLayout = Partial<Record<HudElementId, HudPlacement>>;

export type HudElementDefinition = {
    id: HudElementId;
    label: string;
    watch?: boolean;
    welded?: boolean;
};

export const HUD_ELEMENTS: HudElementDefinition[] = [
    { id: 'minimap', label: 'Minimap' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'police', label: 'Alertes police' },
    { id: 'instructions', label: 'Aide' },
    { id: 'ammo', label: 'Munitions' },
    { id: 'stats', label: 'Statuts du joueur' },
    { id: 'vehicle', label: 'Compteur véhicule' },
    { id: 'progress', label: 'Barre de progression' },
    { id: 'voice', label: 'Icône de voix' },
    { id: 'injuries', label: 'État corporel', watch: true },
    { id: 'datetime', label: 'Date et heure', watch: true, welded: true },
    { id: 'weather', label: 'Météo', watch: true, welded: true },
    { id: 'street', label: 'Nom de rue', watch: true, welded: true },
    { id: 'compass', label: 'Boussole', watch: true, welded: true },
];

export const HUD_ANCHOR_TARGETS: HudAnchorTarget[] = [
    'frame',
    'screen',
    ...HUD_ELEMENTS.filter(element => !element.welded).map(element => element.id),
];

export interface NuiHudLayoutMethodMap {
    SetLayout: HudLayout;
    OpenEditor: HudLayout;
}
