import { FunctionComponent } from 'react';

import { useNuiEvent } from '../../hook/nui';
import { setMenuStyle } from './menuStyleState';

export const MenuStyleApp: FunctionComponent = () => {
    useNuiEvent('menu', 'SetStyle', setMenuStyle);

    return null;
};
