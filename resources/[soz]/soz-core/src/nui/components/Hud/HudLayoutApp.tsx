import { FunctionComponent } from 'react';

import { useNuiEvent } from '../../hook/nui';
import { setHudLayout } from './hudLayoutState';

export const HudLayoutApp: FunctionComponent = () => {
    useNuiEvent('hud_layout', 'SetLayout', setHudLayout);

    return null;
};
