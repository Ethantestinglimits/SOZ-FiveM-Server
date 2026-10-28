import { MinimapStyle } from '../../../shared/nui/minimap';
import { pxToScreenWidth, screenWidthToPx } from '../../utils/screenFrame';

type MinimapBox = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    X: number;
    Y: number;
};

export const applyMinimapShape = <T extends MinimapBox>(minimap: T, style?: MinimapStyle): T => {
    if (!style || style.shape === 'rectangle' || minimap.width <= 0 || minimap.height <= 0) {
        return minimap;
    }

    const side = Math.min(screenWidthToPx(minimap.width), minimap.height * window.innerHeight);
    const width = pxToScreenWidth(side);
    const height = side / window.innerHeight;

    return {
        ...minimap,
        right: minimap.left + width,
        top: minimap.bottom - height,
        width,
        height,
        X: minimap.left + (minimap.X - minimap.left) * (width / minimap.width),
        Y: minimap.bottom + (minimap.Y - minimap.bottom) * (height / minimap.height),
    };
};
