import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { HudAnchorTarget, HudCorner, HudElementId, HudLayout, HudPlacement } from '../../../shared/nui/hud_layout';
import { getScreenFrame } from '../../utils/screenFrame';

export type HudRect = { x: number; y: number; w: number; h: number };

type Entry = {
    element: HTMLElement | null;
    content: HTMLElement | null;
    rect: HudRect | null;
    lastRect: HudRect | null;
    active: boolean;
    correction: [number, number];
};

let layout: HudLayout = {};
let version = 0;
let scheduled = false;
const entries = new Map<HudElementId, Entry>();
const listeners = new Set<(version: number) => void>();
const observed = new Set<HTMLElement>();

const notify = (): void => {
    if (scheduled) {
        return;
    }

    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        version++;
        listeners.forEach(listener => listener(version));
    });
};

const notifyIfPlaced = (): void => {
    if (Object.keys(layout).length > 0) {
        notify();
    }
};

const resizeObserver = new ResizeObserver(notifyIfPlaced);
const mutationObserver = new MutationObserver(notifyIfPlaced);

window.addEventListener('resize', notifyIfPlaced);

const entryOf = (id: HudElementId): Entry => {
    let entry = entries.get(id);

    if (!entry) {
        entry = { element: null, content: null, rect: null, lastRect: null, active: false, correction: [0, 0] };
        entries.set(id, entry);
    }

    return entry;
};

export const setHudLayout = (next: HudLayout): void => {
    layout = next ?? {};
    notify();
};

export const getHudLayout = (): HudLayout => layout;

export const setHudVirtualRect = (id: HudElementId, rect: HudRect | null, active: boolean): void => {
    const entry = entryOf(id);
    const changed =
        entry.active !== active ||
        entry.rect?.x !== rect?.x ||
        entry.rect?.y !== rect?.y ||
        entry.rect?.w !== rect?.w ||
        entry.rect?.h !== rect?.h;

    entry.rect = rect;
    entry.active = active;

    if (rect && active) {
        entry.lastRect = rect;
    }

    if (changed) {
        notify();
    }
};

const cornerFactors = (corner: HudCorner): [number, number] => {
    const fx = corner.includes('left') ? 0 : corner.includes('right') ? 1 : 0.5;
    const fy = corner.startsWith('top') ? 0 : corner.startsWith('bottom') ? 1 : 0.5;

    return [fx, fy];
};

const cornerPoint = (rect: HudRect, corner: HudCorner): [number, number] => {
    const [fx, fy] = cornerFactors(corner);

    return [rect.x + rect.w * fx, rect.y + rect.h * fy];
};

const collapse = (rect: HudRect, targetCorner: HudCorner, corner: HudCorner): HudRect => {
    const [tx, ty] = cornerFactors(targetCorner);
    const [cx, cy] = cornerFactors(corner);
    const outsideX = (tx === 1 && cx === 0) || (tx === 0 && cx === 1);
    const outsideY = (ty === 1 && cy === 0) || (ty === 0 && cy === 1);

    return {
        x: outsideX ? (tx === 1 ? rect.x : rect.x + rect.w) : rect.x,
        y: outsideY ? (ty === 1 ? rect.y : rect.y + rect.h) : rect.y,
        w: outsideX ? 0 : rect.w,
        h: outsideY ? 0 : rect.h,
    };
};

const measure = (entry: Entry): HudRect | null => {
    const element = entry.content ?? entry.element;

    if (element) {
        const bounds = element.getBoundingClientRect();

        if (bounds.width > 0 || bounds.height > 0) {
            return { x: bounds.left, y: bounds.top, w: bounds.width, h: bounds.height };
        }

        return null;
    }

    return entry.rect;
};

const vh = (): number => window.innerHeight / 100;

const placementSize = (id: HudElementId, placement: HudPlacement): [number, number] => {
    const entry = entries.get(id);
    const scale = placement.scale ?? 1;

    const element = entry?.element;

    if (element) {
        return [element.offsetWidth * scale, element.offsetHeight * scale];
    }

    const rect = entry?.rect ?? entry?.lastRect;

    return rect ? [rect.w, rect.h] : [0, 0];
};

export const resolveTargetRect = (target: HudAnchorTarget, depth = 0): HudRect | null => {
    if (target === 'screen') {
        return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    }

    if (target === 'frame') {
        const frame = getScreenFrame();

        return { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    }

    const entry = entries.get(target);

    if (entry?.active) {
        const rect = measure(entry);

        if (rect) {
            entry.lastRect = rect;

            return rect;
        }
    }

    if (entry && !entry.element && entry.rect) {
        return entry.rect;
    }

    const placement = layout[target];

    if (placement && depth < 8) {
        const anchor = resolveTargetRect(placement.target, depth + 1);
        const size = entry?.lastRect;

        if (anchor) {
            const [px, py] = cornerPoint(anchor, placement.targetCorner);
            const [fx, fy] = cornerFactors(placement.corner);
            const w = size?.w ?? 0;
            const h = size?.h ?? 0;

            return { x: px + placement.x * vh() - w * fx, y: py + placement.y * vh() - h * fy, w, h };
        }
    }

    return entry?.lastRect ?? null;
};

export const resolvePlacementRect = (id: HudElementId, placement: HudPlacement): HudRect | null => {
    const [w, h] = placementSize(id, placement);

    return positionRect(placement, w, h);
};

const positionRect = (placement: HudPlacement, w: number, h: number): HudRect | null => {
    const entry = entries.get(placement.target as HudElementId);
    const targetHidden =
        placement.target !== 'screen' && placement.target !== 'frame' && !(entry?.active && measure(entry));
    const anchorRect = resolveTargetRect(placement.target);

    if (!anchorRect) {
        return null;
    }

    const target = targetHidden ? collapse(anchorRect, placement.targetCorner, placement.corner) : anchorRect;
    const [px, py] = cornerPoint(target, placement.targetCorner);
    const [fx, fy] = cornerFactors(placement.corner);

    return { x: px + placement.x * vh() - w * fx, y: py + placement.y * vh() - h * fy, w, h };
};

const placementStyle = (
    id: HudElementId,
    placement: HudPlacement,
    active: boolean,
    fitContent: boolean
): CSSProperties => {
    const rect = resolvePlacementRect(id, placement);

    if (!rect || placement.hidden || !active) {
        return { visibility: 'hidden' };
    }

    return {
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        right: 'auto',
        bottom: 'auto',
        transform: placement.scale && placement.scale !== 1 ? `scale(${placement.scale})` : 'none',
        transformOrigin: 'top left',
        margin: 0,
        ...(fitContent ? { width: 'max-content' } : {}),
    };
};

export const useHudLayoutVersion = (): number => {
    const [current, setCurrent] = useState(version);

    useEffect(() => {
        listeners.add(setCurrent);

        return () => {
            listeners.delete(setCurrent);
        };
    }, []);

    return current;
};

const observe = (element: HTMLElement | null): void => {
    if (element && !observed.has(element)) {
        observed.add(element);
        resizeObserver.observe(element);
        mutationObserver.observe(element, { attributes: true, attributeFilter: ['style', 'class'] });
    }
};

export const useHudBlock = (
    id: HudElementId,
    active: boolean,
    options: { fitContent?: boolean } = {}
): {
    ref: (element: HTMLElement | null) => void;
    measureRef: (element: HTMLElement | null) => void;
    style: CSSProperties | undefined;
    placed: boolean;
} => {
    const entry = entryOf(id);
    const elementRef = useRef<HTMLElement | null>(null);

    useHudLayoutVersion();

    const ref = useCallback(
        (element: HTMLElement | null) => {
            const previous = elementRef.current;

            if (previous && previous !== element) {
                resizeObserver.unobserve(previous);
                observed.delete(previous);
            }

            elementRef.current = element;
            entry.element = element;

            observe(element);
            notify();
        },
        [entry]
    );

    const measureRef = useCallback(
        (element: HTMLElement | null) => {
            entry.content = element;
            observe(element);
            notify();
        },
        [entry]
    );

    useEffect(() => {
        if (entry.active !== active) {
            entry.active = active;
            notify();
        }
    }, [entry, active]);

    const placement = layout[id];
    useLayoutEffect(() => {
        const element = entry.element;

        if (!element) {
            return;
        }

        const [dx, dy] = keepOnScreen(entry);
        const value = dx === 0 && dy === 0 ? '' : `${dx}px ${dy}px`;

        if (element.style.translate !== value) {
            element.style.translate = value;
        }
    });

    return {
        ref,
        measureRef,
        style: placement ? placementStyle(id, placement, active, Boolean(options.fitContent)) : undefined,
        placed: Boolean(placement),
    };
};

const keepOnScreen = (entry: Entry): [number, number] => {
    const element = entry.element;

    if (!element || !entry.active || Object.keys(layout).length === 0) {
        entry.correction = [0, 0];

        return entry.correction;
    }

    const bounds = element.getBoundingClientRect();

    if (bounds.width === 0 && bounds.height === 0) {
        return entry.correction;
    }

    const [cx, cy] = entry.correction;
    const left = bounds.left - cx;
    const top = bounds.top - cy;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dx = left < 0 ? -left : left + bounds.width > width ? Math.max(width - left - bounds.width, -left) : 0;
    const dy = top < 0 ? -top : top + bounds.height > height ? Math.max(height - top - bounds.height, -top) : 0;

    entry.correction = [Math.round(dx), Math.round(dy)];

    return entry.correction;
};

type MinimapBox = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    X: number;
    Y: number;
    isHidden?: boolean;
};

export const placeMinimap = <T extends MinimapBox>(minimap: T): T => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const base: HudRect = {
        x: minimap.left * width,
        y: minimap.top * height,
        w: minimap.width * width,
        h: minimap.height * height,
    };
    const active = !minimap.isHidden;
    const placement = layout.minimap;

    if (!placement || placement.target === 'minimap') {
        setHudVirtualRect('minimap', base, active);

        return minimap;
    }

    const scale = placement.scale ?? 1;
    const rect = positionRect(placement, base.w * scale, base.h * scale);

    if (!rect) {
        setHudVirtualRect('minimap', base, active);

        return minimap;
    }

    setHudVirtualRect('minimap', rect, active && !placement.hidden);

    const left = rect.x / width;
    const top = rect.y / height;
    const boxWidth = rect.w / width;
    const boxHeight = rect.h / height;
    const ratioX = minimap.width > 0 ? boxWidth / minimap.width : 1;
    const ratioY = minimap.height > 0 ? boxHeight / minimap.height : 1;

    return {
        ...minimap,
        isHidden: minimap.isHidden || Boolean(placement.hidden),
        left,
        right: left + boxWidth,
        top,
        bottom: top + boxHeight,
        width: boxWidth,
        height: boxHeight,
        X: left + (minimap.X - minimap.left) * ratioX,
        Y: top + boxHeight + (minimap.Y - minimap.bottom) * ratioY,
    };
};
