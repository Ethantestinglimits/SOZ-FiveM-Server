import { FunctionComponent, ReactNode } from 'react';

import { PauseMenuData } from '../../../shared/nui/pause_menu';

export type PauseTab = {
    id: string;
    label: string;
    icon: ReactNode;
    component: FunctionComponent<{ data: PauseMenuData }>;
    hints?: [string, string][];
    fullscreen?: boolean;
};

const tabs: PauseTab[] = [];

export const registerPauseTab = (tab: PauseTab): void => {
    if (!tabs.some(existing => existing.id === tab.id)) {
        tabs.push(tab);
    }
};

export const getPauseTabs = (): PauseTab[] => tabs;

const requests = new Set<(id: string) => void>();

export const openPauseTab = (id: string): void => {
    requests.forEach(listener => listener(id));
};

export const onPauseTabRequest = (listener: (id: string) => void): (() => void) => {
    requests.add(listener);

    return () => {
        requests.delete(listener);
    };
};
