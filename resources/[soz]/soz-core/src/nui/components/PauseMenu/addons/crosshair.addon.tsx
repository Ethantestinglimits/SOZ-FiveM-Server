import { FunctionComponent, useEffect, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import { CrosshairProfiles } from '../../../../shared/nui/crosshair';
import { fetchNui } from '../../../fetch';
import { registerSettingCategory } from '../settings/registry';
import { CrosshairPanel } from './crosshair/CrosshairPanel';

const CrosshairIcon: FunctionComponent = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="7" />
        <path strokeLinecap="round" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
);

const CrosshairPage: FunctionComponent = () => {
    const [profiles, setProfiles] = useState<CrosshairProfiles | null>(null);

    useEffect(() => {
        fetchNui<void, CrosshairProfiles>(NuiEvent.CrosshairProfilesGet).then(setProfiles);
    }, []);

    return profiles ? <CrosshairPanel initial={profiles} /> : null;
};

registerSettingCategory(
    { id: 'crosshair', label: 'Viseur', native: false, items: [] },
    {
        after: 'menus',
        icon: <CrosshairIcon />,
        panel: { component: CrosshairPage, replacesList: true, hidesDescription: true },
    }
);
