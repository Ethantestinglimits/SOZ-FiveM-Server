import { useEffect, useState } from 'react';
import { Middleware } from 'redux';

type ModelName = 'hud' | 'vehicle';

type Override = (real: any) => unknown;

export type HudPreviewOverrides = Partial<Record<ModelName, Record<string, Override>>>;

type StoreApi = { getState: () => any; dispatch: (action: any) => any };

let api: StoreApi | null = null;
let overrides: HudPreviewOverrides | null = null;
let applying = false;
const real: Record<ModelName, Record<string, unknown>> = { hud: {}, vehicle: {} };

const MODELS: ModelName[] = ['hud', 'vehicle'];

const apply = (model: ModelName, payload: Record<string, unknown>): void => {
    if (!api || Object.keys(payload).length === 0) {
        return;
    }

    applying = true;
    api.dispatch({ type: `${model}/update`, payload });
    applying = false;
};

export const hudPreviewMiddleware: Middleware = store => {
    api = store;

    return next => action => {
        const type = (action as { type?: string }).type;
        const model = type === 'hud/update' ? 'hud' : type === 'vehicle/update' ? 'vehicle' : null;
        const active = overrides && model ? overrides[model] : null;

        if (applying || !active) {
            return next(action);
        }

        const payload = { ...((action as { payload?: Record<string, unknown> }).payload ?? {}) };
        const patched: Record<string, unknown> = {};

        for (const key of Object.keys(active)) {
            if (key in payload) {
                real[model][key] = payload[key];
                patched[key] = active[key](payload[key]);
                delete payload[key];
            }
        }

        const result = next({ ...(action as object), payload } as typeof action);

        apply(model, patched);

        return result;
    };
};

export const setHudPreview = (next: HudPreviewOverrides | null): void => {
    if (!api) {
        return;
    }

    const state = api.getState();

    for (const model of MODELS) {
        const previous = overrides?.[model] ?? {};
        const current = next?.[model] ?? {};
        const restore: Record<string, unknown> = {};
        const patched: Record<string, unknown> = {};

        for (const key of Object.keys(previous)) {
            if (!(key in current)) {
                restore[key] = real[model][key];
                delete real[model][key];
            }
        }

        for (const key of Object.keys(current)) {
            if (!(key in previous)) {
                real[model][key] = state[model]?.[key];
            }

            patched[key] = current[key](real[model][key]);
        }

        apply(model, { ...restore, ...patched });
    }

    overrides = next;
};

let editing = false;
const editingListeners = new Set<(value: boolean) => void>();

export const setHudEditing = (value: boolean): void => {
    editing = value;
    editingListeners.forEach(listener => listener(value));
};

export const useHudEditing = (): boolean => {
    const [value, setValue] = useState(editing);

    useEffect(() => {
        editingListeners.add(setValue);
        setValue(editing);

        return () => {
            editingListeners.delete(setValue);
        };
    }, []);

    return value;
};
