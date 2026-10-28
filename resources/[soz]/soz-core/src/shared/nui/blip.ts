export type BlipAction = {
    id: string;
    label: string;
    blipId: string;
};

export type BlipInfo = {
    name: string;
    index: number;
    total: number;
};

export interface NuiBlipMethodMap {
    SetActions: BlipAction[];
    SetInfo: BlipInfo | null;
}
