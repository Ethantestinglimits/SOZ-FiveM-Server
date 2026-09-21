import { Vector3 } from '@public/shared/polyzone/vector';

import { JobType } from './job';

export enum TargetMode {
    /** B-Target: crosshair au centre de l'écran, options affichées de part et d'autre */
    Crosshair = 'crosshair',
    /** Menu contextuel classique: curseur libre, clic sur un prop/joueur/véhicule */
    Cursor = 'cursor',
}

export const TargetModeLabels: Record<TargetMode, string> = {
    [TargetMode.Crosshair]: 'B-Target',
    [TargetMode.Cursor]: 'Menu contextuel',
};

export type TargetContext = {
    id?: string;
    entity?: number;
    entityCoords?: Vector3;
};

export type TargetOption = TargetContext & {
    label: string;
    subLabel?: string;
    icon?: string;
    category: 'citizen' | 'society' | 'criminal';
    order?: string;

    /** Menu contextuel uniquement: les options d'un même groupe sont regroupées dans un sous-menu */
    group?: string;
    /** Menu contextuel uniquement: affiche l'option comme un interrupteur (allumé/éteint) */
    checked?: boolean;
    /** Menu contextuel uniquement: état de l'interrupteur, recalculé à chaque affichage (options enregistrées une fois) */
    isChecked?: () => boolean;
    /** Menu contextuel uniquement: garde le menu ouvert après l'action, les options sont alors recalculées */
    keepOpen?: boolean;

    item?: string;
    event?: string;
    blackoutGlobal?: boolean;
    blackoutJob?: JobType;
    job?: string | JobType | Partial<{ [key in JobType]: number }>;
    canInteract?: (entity?: number) => boolean | Promise<boolean>;

    action?: (entity?: number, entityCoords?: Vector3) => void;
    distance?: number;
};
