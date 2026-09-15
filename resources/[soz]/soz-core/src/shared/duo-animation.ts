import { AnimationInfo } from './animation';
import { Vector4 } from './polyzone/vector';

export type DuoAnimationRole = 'initiator' | 'target';

export type DuoAnimation = {
    id: string;
    label: string;
    distance: number;
    initiator: AnimationInfo;
    target: AnimationInfo;
};

export type DuoAnimationConfigCategory = {
    type: 'category';
    name: string;
    items: DuoAnimationConfigItem[];
};

export type DuoAnimationConfigAnimation = {
    type: 'animation';
    animation: DuoAnimation;
};

export type DuoAnimationConfigItem = DuoAnimationConfigCategory | DuoAnimationConfigAnimation;

export type DuoAnimationConfigList = DuoAnimationConfigItem[];

export type DuoAnimationMenuData = {
    targetServerId: number;
};

export type DuoAnimationPlayPayload = {
    animationId: string;
    role: DuoAnimationRole;
    partnerId: number;
    coords: Vector4;
};

export const findDuoAnimationById = (items: DuoAnimationConfigList, id: string): DuoAnimation | null => {
    for (const item of items) {
        if (item.type === 'animation') {
            if (item.animation.id === id) {
                return item.animation;
            }
        } else {
            const found = findDuoAnimationById(item.items, id);

            if (found) {
                return found;
            }
        }
    }

    return null;
};
