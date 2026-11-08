import { FunctionComponent, ReactNode } from 'react';

import { SETTING_CATEGORIES, SettingCategory, SOZ_CATEGORY_IDS } from './definitions';

export type SettingsPanelProps = {
    category: SettingCategory;
    query: string;
};

export type SettingsPanel = {
    component: FunctionComponent<SettingsPanelProps>;
    replacesList?: boolean;
    hidesDescription?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
};

const panels = new Map<string, SettingsPanel>();
const icons = new Map<string, ReactNode>();

export const registerSettingsPanel = (categoryId: string, panel: SettingsPanel): void => {
    panels.set(categoryId, panel);
};

export const getSettingsPanel = (categoryId: string): SettingsPanel | undefined => panels.get(categoryId);

export const getCategoryIcon = (categoryId: string): ReactNode => icons.get(categoryId) ?? null;

export const registerCategoryIcon = (categoryId: string, icon: ReactNode): void => {
    icons.set(categoryId, icon);
};

export const registerSettingCategory = (
    category: SettingCategory,
    options: { after?: string; icon?: ReactNode; group?: 'soz' | 'game'; panel?: SettingsPanel } = {}
): void => {
    if (SETTING_CATEGORIES.some(existing => existing.id === category.id)) {
        return;
    }

    const anchor = options.after ? SETTING_CATEGORIES.findIndex(existing => existing.id === options.after) : -1;

    SETTING_CATEGORIES.splice(anchor >= 0 ? anchor + 1 : SETTING_CATEGORIES.length, 0, category);

    if (options.group !== 'game') {
        SOZ_CATEGORY_IDS.push(category.id);
    }

    if (options.icon) {
        registerCategoryIcon(category.id, options.icon);
    }

    if (options.panel) {
        registerSettingsPanel(category.id, options.panel);
    }
};
