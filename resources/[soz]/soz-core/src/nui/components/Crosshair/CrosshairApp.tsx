import { FunctionComponent, useState } from 'react';

import { CrosshairConfig, DEFAULT_CROSSHAIR } from '../../../shared/nui/crosshair';
import { useNuiEvent } from '../../hook/nui';
import { CrosshairView } from './CrosshairView';

const GAME_SIZE = '9.26vh';

export const CrosshairApp: FunctionComponent = () => {
    const [config, setConfig] = useState<CrosshairConfig>(DEFAULT_CROSSHAIR);
    const [visible, setVisible] = useState(false);

    useNuiEvent('crosshair', 'Config', setConfig);
    useNuiEvent('crosshair', 'Visible', setVisible);

    if (!visible) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 1 }}>
            <CrosshairView config={config} size={GAME_SIZE} />
        </div>
    );
};
