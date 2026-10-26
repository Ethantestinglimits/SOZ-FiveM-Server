export type HudElementId = 'minimap' | 'notifications' | 'police' | 'instructions' | 'ammo';

export type HudPosition = {
    x: number;
    y: number;
};

export type HudLayout = Partial<Record<HudElementId, HudPosition>>;

export type HudElementAnchor = 'bottom-left' | 'top-center' | 'top-right';

export type HudElementDefinition = {
    id: HudElementId;
    label: string;
    width: number;
    height: number;
    anchor: HudElementAnchor;
};

export const HUD_ELEMENTS: HudElementDefinition[] = [
    { id: 'minimap', label: 'Groupe Minimap', width: 14, height: 18, anchor: 'bottom-left' },
    { id: 'notifications', label: 'Notifications', width: 18, height: 26, anchor: 'bottom-left' },
    { id: 'police', label: 'Alertes police', width: 21, height: 30, anchor: 'top-right' },
    { id: 'instructions', label: 'Aide', width: 26, height: 4.5, anchor: 'top-center' },
    { id: 'ammo', label: 'Munitions', width: 7, height: 6, anchor: 'top-right' },
];

export interface NuiHudLayoutMethodMap {
    SetLayout: HudLayout;
    OpenEditor: HudLayout;
}
