import { FunctionComponent, useEffect } from 'react';

import { NuiEvent } from '../../../shared/event';
import { fetchNui } from '../../fetch';
import { useNuiEvent } from '../../hook/nui';
import { setHudLayout } from './hudLayoutState';

export const HudLayoutApp: FunctionComponent = () => {
    useNuiEvent('hud_layout', 'SetLayout', setHudLayout);

    useEffect(() => {
        fetchNui(NuiEvent.HudLayoutRequest);
    }, []);

    return null;
};
