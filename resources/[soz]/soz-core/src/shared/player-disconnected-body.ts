import { Outfit } from '@public/shared/cloth';
import { Vector4 } from '@public/shared/polyzone/vector';

import { Skin } from './player';

export type DisconnectedBodyAnimation = {
    dictionary?: string;
    name: string;
};

export type DisconnectedBodySnapshot = {
    citizenId: string;
    position: Vector4;
    model: number;
    skin: Skin;
    outfit: Outfit;
    animation: DisconnectedBodyAnimation | null;
    isDead: boolean;
    vehicleNetId?: number;
    vehicleSeatIndex?: number;
};
