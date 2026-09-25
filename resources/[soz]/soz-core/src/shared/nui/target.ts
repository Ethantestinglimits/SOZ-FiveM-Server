import { TargetMode } from '../target';

export type TargetCursorMenuPosition = {
    /** Position du clic, en fraction de la largeur de l'écran (0-1) */
    x: number;
    /** Position du clic, en fraction de la hauteur de l'écran (0-1) */
    y: number;
};

export interface NuiTargetMethodMap {
    SetTargeting: boolean;
    SetTargetFound: boolean;
    SetTargets: any[];
    SetTargetMode: TargetMode;
    SetCursorHover: boolean;
    SetCursorMenu: TargetCursorMenuPosition | null;
}
