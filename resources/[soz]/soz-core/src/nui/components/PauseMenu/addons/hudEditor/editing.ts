import {
    HUD_CORNERS,
    HUD_ELEMENTS,
    HUD_SCALE_MAX,
    HUD_SCALE_MIN,
    HudAnchorTarget,
    HudCorner,
    HudElementId,
    HudLayout,
    HudPlacement,
} from '../../../../../shared/nui/hud_layout';
import { getHudBlockRect, getHudCornerPoint, HudRect, resolveTargetRect } from '../../../Hud/hudPlacement';

export const EDITABLE = HUD_ELEMENTS.filter(element => !element.welded);

const BLOCK_REACH = 6;
const SNAP = 0.8;

export type BlockRects = Partial<Record<HudElementId, HudRect>>;

export type Guides = { x: number[]; y: number[] };

const vh = (): number => window.innerHeight / 100;

const round = (value: number): number => Math.round(value * 100) / 100;

export const readBlockRects = (): BlockRects => {
    const rects: BlockRects = {};

    for (const element of EDITABLE) {
        const rect = getHudBlockRect(element.id);

        if (rect && (rect.w > 0 || rect.h > 0)) {
            rects[element.id] = rect;
        }
    }

    return rects;
};

export const dependsOn = (layout: HudLayout, target: HudAnchorTarget, id: HudElementId, depth = 0): boolean => {
    if (target === id) {
        return true;
    }

    if (target === 'frame' || target === 'screen' || depth > 16) {
        return false;
    }

    const placement = layout[target];

    if (placement) {
        return dependsOn(layout, placement.target, id, depth + 1);
    }

    return target !== 'minimap' && dependsOn(layout, 'minimap', id, depth + 1);
};

const offsetBetween = (
    rect: HudRect,
    target: HudRect,
    targetCorner: HudCorner,
    corner: HudCorner
): [number, number] => {
    const [px, py] = getHudCornerPoint(target, targetCorner);
    const [qx, qy] = getHudCornerPoint(rect, corner);

    return [round((qx - px) / vh()), round((qy - py) / vh())];
};

const independentRects = (id: HudElementId, layout: HudLayout, rects: BlockRects): [HudElementId, HudRect][] =>
    (Object.entries(rects) as [HudElementId, HudRect][]).filter(
        ([other]) => other !== id && !dependsOn(layout, other, id)
    );

const keep = (previous: HudPlacement | undefined): Partial<HudPlacement> => ({
    ...(previous?.scale !== undefined ? { scale: previous.scale } : {}),
    ...(previous?.hidden ? { hidden: true } : {}),
    ...(previous?.enter ? { enter: previous.enter } : {}),
});

const edgeAnchor = (rect: HudRect, previous: HudPlacement | undefined): HudPlacement | null => {
    const frame = resolveTargetRect('frame');
    const center = rect.x + rect.w / 2;
    const target = frame && (center < frame.x || center > frame.x + frame.w) ? 'screen' : 'frame';
    const targetRect = resolveTargetRect(target);

    if (!targetRect) {
        return null;
    }

    let best: { placement: HudPlacement; distance: number } | null = null;

    for (const corner of HUD_CORNERS) {
        const [x, y] = offsetBetween(rect, targetRect, corner, corner);
        const distance = Math.hypot(x, y);

        if (!best || distance < best.distance) {
            best = { placement: { target, targetCorner: corner, corner, x, y, ...keep(previous) }, distance };
        }
    }

    return best?.placement ?? null;
};

export const absolutePlacement = (rect: HudRect, previous: HudPlacement | undefined): HudPlacement => ({
    target: 'screen',
    targetCorner: 'top-left',
    corner: 'top-left',
    x: round(rect.x / vh()),
    y: round(rect.y / vh()),
    ...keep(previous),
});

export const anchorFor = (
    id: HudElementId,
    rect: HudRect,
    layout: HudLayout,
    rects: BlockRects
): HudPlacement | null => {
    const previous = layout[id];
    let best: { placement: HudPlacement; distance: number } | null = null;

    for (const [other, target] of independentRects(id, layout, rects)) {
        for (const targetCorner of HUD_CORNERS) {
            for (const corner of HUD_CORNERS) {
                const [x, y] = offsetBetween(rect, target, targetCorner, corner);
                const distance = Math.hypot(x, y);

                if (distance < BLOCK_REACH && (!best || distance < best.distance)) {
                    best = {
                        placement: { target: other, targetCorner, corner, x, y, ...keep(previous) },
                        distance,
                    };
                }
            }
        }
    }

    return best?.placement ?? edgeAnchor(rect, previous);
};

const rootEdge = (layout: HudLayout, id: HudElementId, rects: BlockRects, depth = 0): 'top' | 'bottom' => {
    const placement = layout[id];
    const rect = rects[id] ?? resolveTargetRect(id);
    const byHalf = rect && rect.y + rect.h / 2 < window.innerHeight / 2 ? 'top' : 'bottom';

    if (!placement || depth > 16) {
        return byHalf;
    }

    if (placement.target === 'frame' || placement.target === 'screen') {
        return placement.targetCorner.startsWith('top')
            ? 'top'
            : placement.targetCorner.startsWith('bottom')
              ? 'bottom'
              : byHalf;
    }

    return rootEdge(layout, placement.target, rects, depth + 1);
};

const stackCorner = (vertical: 'top' | 'bottom', horizontal: 'left' | 'center' | 'right'): HudCorner =>
    (horizontal === 'center' ? vertical : `${vertical}-${horizontal}`) as HudCorner;

const alignment = (rect: HudRect, other: HudRect): 'left' | 'center' | 'right' => {
    const gaps: ['left' | 'center' | 'right', number][] = [
        ['left', Math.abs(rect.x - other.x)],
        ['center', Math.abs(rect.x + rect.w / 2 - (other.x + other.w / 2))],
        ['right', Math.abs(rect.x + rect.w - (other.x + other.w))],
    ];

    return gaps.sort((a, b) => a[1] - b[1])[0][0];
};

export const dropLayout = (id: HudElementId, rect: HudRect, layout: HudLayout, rects: BlockRects): HudLayout => {
    const placement = anchorFor(id, rect, layout, rects);

    if (!placement) {
        return layout;
    }

    if (placement.target === 'frame' || placement.target === 'screen') {
        return { ...layout, [id]: placement };
    }

    const target = placement.target;
    const targetRect = rects[target];
    const root = rootEdge(layout, target, rects);
    const tolerance = vh();
    const edgeSide =
        targetRect &&
        ((root === 'bottom' && rect.y >= targetRect.y + targetRect.h - tolerance) ||
            (root === 'top' && rect.y + rect.h <= targetRect.y + tolerance));

    if (!edgeSide || !targetRect) {
        return { ...layout, [id]: placement };
    }

    const targetPlacement = layout[target];
    const parentRect = targetPlacement ? resolveTargetRect(targetPlacement.target) : null;
    let own: HudPlacement | null;

    if (targetPlacement && parentRect) {
        const [x, y] = offsetBetween(rect, parentRect, targetPlacement.targetCorner, targetPlacement.corner);
        own = {
            target: targetPlacement.target,
            targetCorner: targetPlacement.targetCorner,
            corner: targetPlacement.corner,
            x,
            y,
            ...keep(layout[id]),
        };
    } else {
        own = edgeAnchor(rect, layout[id]);
    }

    if (!own) {
        return { ...layout, [id]: placement };
    }

    const horizontal = alignment(targetRect, rect);
    const outer = root === 'bottom' ? 'top' : 'bottom';
    const inner = root === 'bottom' ? 'bottom' : 'top';
    const targetCorner = stackCorner(outer, horizontal);
    const corner = stackCorner(inner, horizontal);
    const [x, y] = offsetBetween(targetRect, rect, targetCorner, corner);

    return {
        ...layout,
        [id]: own,
        [target]: { target: id, targetCorner, corner, x, y, ...keep(targetPlacement) },
    };
};

const axisLines = (rects: HudRect[], horizontal: boolean): number[] =>
    rects.flatMap(rect =>
        horizontal ? [rect.x, rect.x + rect.w / 2, rect.x + rect.w] : [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
    );

const snapAxis = (values: number[], lines: number[]): { delta: number; lines: number[] } => {
    let delta = 0;
    let distance = SNAP * vh();

    for (const value of values) {
        for (const line of lines) {
            const gap = line - value;

            if (Math.abs(gap) < distance) {
                distance = Math.abs(gap);
                delta = gap;
            }
        }
    }

    const snapped = values.map(value => value + delta);

    return {
        delta,
        lines: distance < SNAP * vh() ? lines.filter(line => snapped.some(value => Math.abs(line - value) < 0.5)) : [],
    };
};

export const snapRect = (
    id: HudElementId,
    rect: HudRect,
    layout: HudLayout,
    rects: BlockRects
): { rect: HudRect; guides: Guides } => {
    const references = [
        ...independentRects(id, layout, rects).map(([, other]) => other),
        resolveTargetRect('frame'),
        resolveTargetRect('screen'),
    ].filter((other): other is HudRect => Boolean(other));

    const x = snapAxis([rect.x, rect.x + rect.w / 2, rect.x + rect.w], axisLines(references, true));
    const y = snapAxis([rect.y, rect.y + rect.h / 2, rect.y + rect.h], axisLines(references, false));

    return {
        rect: { ...rect, x: rect.x + x.delta, y: rect.y + y.delta },
        guides: { x: Array.from(new Set(x.lines)), y: Array.from(new Set(y.lines)) },
    };
};

export const nudge = (placement: HudPlacement, dx: number, dy: number): HudPlacement => ({
    ...placement,
    x: round(Math.max(-200, Math.min(200, placement.x + dx))),
    y: round(Math.max(-200, Math.min(200, placement.y + dy))),
});

export const clampScale = (scale: number): number =>
    Math.round(Math.max(HUD_SCALE_MIN, Math.min(HUD_SCALE_MAX, scale)) * 100) / 100;

export const anchorTargets = (id: HudElementId, layout: HudLayout, rects: BlockRects): HudAnchorTarget[] => [
    'frame',
    'screen',
    ...independentRects(id, layout, rects).map(([other]) => other),
];

export const reanchor = (
    id: HudElementId,
    rect: HudRect,
    layout: HudLayout,
    target: HudAnchorTarget,
    targetCorner: HudCorner
): HudPlacement | null => {
    const targetRect = resolveTargetRect(target);

    if (!targetRect) {
        return null;
    }

    let corner = targetCorner;

    if (target !== 'frame' && target !== 'screen') {
        let distance = Infinity;

        for (const candidate of HUD_CORNERS) {
            const gap = Math.hypot(...offsetBetween(rect, targetRect, targetCorner, candidate));

            if (gap < distance) {
                distance = gap;
                corner = candidate;
            }
        }
    }

    const [x, y] = offsetBetween(rect, targetRect, targetCorner, corner);

    return { target, targetCorner, corner, x, y, ...keep(layout[id]) };
};
