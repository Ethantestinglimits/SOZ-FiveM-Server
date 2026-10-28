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

export type HudPosition = {
    x: number;
    y: number;
    scale?: number;
};

export type HudLayout = Partial<Record<HudElementId, HudPosition>>;

export type HudElementAnchor =
    | 'bottom-left'
    | 'bottom-right'
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-center';

export type HudElementDefinition = {
    id: HudElementId;
    label: string;
    width: number;
    height: number;
    anchor: HudElementAnchor;
    watch?: boolean;
};

export const HUD_ELEMENTS: HudElementDefinition[] = [
    { id: 'minimap', label: 'Minimap', width: 14, height: 18, anchor: 'bottom-left' },
    { id: 'notifications', label: 'Notifications', width: 18, height: 26, anchor: 'bottom-left' },
    { id: 'police', label: 'Alertes police', width: 21, height: 30, anchor: 'top-right' },
    { id: 'instructions', label: 'Aide', width: 26, height: 4.5, anchor: 'top-center' },
    { id: 'ammo', label: 'Munitions', width: 7, height: 6, anchor: 'top-right' },
    { id: 'stats', label: 'Statuts du joueur', width: 14, height: 5, anchor: 'top-left' },
    { id: 'vehicle', label: 'Compteur véhicule', width: 30, height: 12, anchor: 'bottom-center' },
    { id: 'progress', label: 'Barre de progression', width: 28, height: 7, anchor: 'top-center' },
    { id: 'datetime', label: 'Date et heure', width: 7, height: 5, anchor: 'bottom-left', watch: true },
    { id: 'weather', label: 'Météo', width: 7, height: 5, anchor: 'bottom-right', watch: true },
    { id: 'street', label: 'Nom de rue', width: 14, height: 5, anchor: 'top-left', watch: true },
    { id: 'compass', label: 'Boussole', width: 3, height: 5, anchor: 'top-left', watch: true },
    { id: 'voice', label: 'Icône de voix', width: 3, height: 5, anchor: 'bottom-left' },
    { id: 'injuries', label: 'État corporel', width: 8, height: 30, anchor: 'top-right', watch: true },
];

export interface NuiHudLayoutMethodMap {
    SetLayout: HudLayout;
    OpenEditor: HudLayout;
}
