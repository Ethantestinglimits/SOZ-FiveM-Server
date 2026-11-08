import { useEffect, useState } from 'react';

export type PendingApply = {
    count: number;
    label: string;
    busy?: boolean;
    native?: boolean;
    apply: () => void;
    cancel?: () => void;
};

const sources = new Map<string, PendingApply>();
const listeners = new Set<(pending: PendingApply | null) => void>();

const current = (): PendingApply | null => sources.values().next().value ?? null;

const setPending = (source: string, pending: PendingApply | null): void => {
    if (pending) {
        sources.set(source, pending);
    } else if (sources.has(source)) {
        sources.delete(source);
    } else {
        return;
    }

    const next = current();

    listeners.forEach(listener => listener(next));
};

export const usePublishPendingApply = (source: string, pending: PendingApply | null): void => {
    useEffect(() => {
        setPending(source, pending);
    });

    useEffect(() => () => setPending(source, null), [source]);
};

export const usePendingApply = (): PendingApply | null => {
    const [pending, setPendingState] = useState(current);

    useEffect(() => {
        listeners.add(setPendingState);
        setPendingState(current());

        return () => {
            listeners.delete(setPendingState);
        };
    }, []);

    return pending;
};
