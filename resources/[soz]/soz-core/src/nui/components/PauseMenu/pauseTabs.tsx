import { FunctionComponent, ReactNode } from 'react';

import { PauseMenuData } from '../../../shared/nui/pause_menu';

export type PauseTab = {
    id: string;
    label: string;
    icon: ReactNode;
    component: FunctionComponent<{ data: PauseMenuData }>;
    hints?: [string, string][];
};

const tabs: PauseTab[] = [];

export const registerPauseTab = (tab: PauseTab): void => {
    if (!tabs.some(existing => existing.id === tab.id)) {
        tabs.push(tab);
    }
};

export const getPauseTabs = (): PauseTab[] => tabs;
