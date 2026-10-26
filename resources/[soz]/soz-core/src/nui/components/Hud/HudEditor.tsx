import classNames from 'classnames';
import { CSSProperties, FunctionComponent, PointerEvent as ReactPointerEvent, useRef, useState } from 'react';

import { NuiEvent } from '../../../shared/event';
import { Minimap } from '../../../shared/hud';
import {
    HUD_ELEMENTS,
    HUD_SCALE_MAX,
    HUD_SCALE_MIN,
    HudElementAnchor,
    HudElementDefinition,
    HudElementId,
    HudLayout,
    HudPosition,
} from '../../../shared/nui/hud_layout';
import { fetchNui } from '../../fetch';
import { useKeyPress } from '../../hook/control';
import { useHudHasStreetNames, useMinimap } from '../../hook/data';
import { useNuiEvent, useNuiFocus } from '../../hook/nui';
import { HudPreview } from './HudPreview';
import { setHudLayout, shiftMinimap } from './hudLayoutState';

const SNAP = 1;
const HANDLE_SIZE = 14;
const OUTLINE_WIDTH = 2;
const MIN_RESIZE_DISTANCE = 24;

const CORNERS = [
    { id: 'top-left', left: '0%', top: '0%' },
    { id: 'top-right', left: '100%', top: '0%' },
    { id: 'bottom-left', left: '0%', top: '100%' },
    { id: 'bottom-right', left: '100%', top: '100%' },
];

const snap = (value: number) => Math.round(value / SNAP) * SNAP;

const clampScale = (value: number) =>
    Math.round(Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, value)) * 100) / 100;

const defaultPosition = (id: HudElementId, minimap: Minimap, hasStreetNames: boolean): HudPosition => {
    switch (id) {
        case 'minimap':
            return { x: minimap.left * 100, y: minimap.bottom * 100 };
        case 'police':
            return { x: 99.2, y: 0.8 };
        case 'notifications':
            return { x: (minimap.left + 0.004) * 100, y: minimap.top * 100 };
        case 'instructions':
            return { x: 50, y: 100 - minimap.bottom * 100 };
        case 'ammo':
            return { x: 100 - (minimap.left + 0.005) * 100, y: minimap.bottom * 100 - 5 };
        case 'stats':
            return { x: (minimap.left + minimap.width + 0.012) * 100, y: (minimap.bottom + 0.005) * 100 };
        case 'vehicle':
            return { x: 50, y: minimap.bottom * 100 + (hasStreetNames ? 5.5 : 0) };
        case 'progress':
            return { x: 50, y: (minimap.bottom + 0.005) * 100 - (hasStreetNames ? 0 : 6) };
    }
};

type Size = { width: number; height: number };

const boxFor = (anchor: HudElementAnchor, size: Size, position: HudPosition) => {
    switch (anchor) {
        case 'bottom-left':
            return { left: position.x, top: position.y - size.height };
        case 'top-left':
            return { left: position.x, top: position.y };
        case 'top-center':
            return { left: position.x - size.width / 2, top: position.y };
        case 'top-right':
            return { left: position.x - size.width, top: position.y };
        case 'bottom-center':
            return { left: position.x - size.width / 2, top: position.y - size.height };
    }
};

const clampPosition = (anchor: HudElementAnchor, size: Size, position: HudPosition): HudPosition => {
    const box = boxFor(anchor, size, position);
    const dx = Math.min(0, 100 - size.width - box.left) + Math.max(0, -box.left);
    const dy = Math.min(0, 100 - size.height - box.top) + Math.max(0, -box.top);

    return { ...position, x: snap(position.x + dx), y: snap(position.y + dy) };
};

const blockStyle = (anchor: HudElementAnchor, position: HudPosition): CSSProperties => {
    const scale = position.scale ?? 1;
    const scaled = scale === 1 ? '' : ` scale(${scale})`;

    switch (anchor) {
        case 'bottom-left':
            return {
                left: `${position.x}vw`,
                bottom: `${100 - position.y}vh`,
                transformOrigin: 'bottom left',
                transform: scaled.trim() || undefined,
            };
        case 'top-left':
            return {
                left: `${position.x}vw`,
                top: `${position.y}vh`,
                transformOrigin: 'top left',
                transform: scaled.trim() || undefined,
            };
        case 'top-center':
            return {
                left: `${position.x}vw`,
                top: `${position.y}vh`,
                transformOrigin: 'top center',
                transform: `translateX(-50%)${scaled}`,
            };
        case 'top-right':
            return {
                right: `${100 - position.x}vw`,
                top: `${position.y}vh`,
                transformOrigin: 'top right',
                transform: scaled.trim() || undefined,
            };
        case 'bottom-center':
            return {
                left: `${position.x}vw`,
                bottom: `${100 - position.y}vh`,
                transformOrigin: 'bottom center',
                transform: `translateX(-50%)${scaled}`,
            };
    }
};

const anchorPoint = (anchor: HudElementAnchor, rect: DOMRect): [number, number] => {
    switch (anchor) {
        case 'bottom-left':
            return [rect.left, rect.bottom];
        case 'top-left':
            return [rect.left, rect.top];
        case 'top-center':
            return [rect.left + rect.width / 2, rect.top];
        case 'top-right':
            return [rect.right, rect.top];
        case 'bottom-center':
            return [rect.left + rect.width / 2, rect.bottom];
    }
};

type DragState =
    | { kind: 'move'; id: HudElementId; startX: number; startY: number; origin: HudPosition; size: Size }
    | {
          kind: 'resize';
          id: HudElementId;
          origin: HudPosition;
          size: Size;
          anchorX: number;
          anchorY: number;
          startDistance: number;
      };

export const HudEditor: FunctionComponent = () => {
    const rawMinimap = useMinimap();
    const hasStreetNames = useHudHasStreetNames();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<HudLayout>({});
    const [selected, setSelected] = useState<HudElementId | null>(null);
    const [hovered, setHovered] = useState<HudElementId | null>(null);
    const minimap = shiftMinimap(rawMinimap, draft.minimap);

    const blocks = useRef<Partial<Record<HudElementId, HTMLDivElement | null>>>({});
    const drag = useRef<DragState | null>(null);

    useNuiFocus(open, open, false);

    useNuiEvent('hud_layout', 'OpenEditor', (layout) => {
        setDraft(layout);
        setSelected(null);
        setOpen(true);
    });

    const cancel = () => setOpen(false);

    const save = () => {
        fetchNui(NuiEvent.HudLayoutSave, draft);
        setOpen(false);
    };

    const reset = () => {
        setDraft({});
        setSelected(null);
        setHudLayout({});
        fetchNui(NuiEvent.HudLayoutReset);
    };

    useKeyPress('Escape', () => {
        if (open) {
            cancel();
        }
    });

    const fixedSize = (element: HudElementDefinition): Size =>
        element.id === 'minimap'
            ? { width: rawMinimap.width * 100 || element.width, height: rawMinimap.height * 100 || element.height }
            : { width: element.width, height: element.height };

    const measuredSize = (element: HudElementDefinition): Size => {
        const node = blocks.current[element.id];

        if (!node) {
            return fixedSize(element);
        }

        const rect = node.getBoundingClientRect();

        return { width: (rect.width / window.innerWidth) * 100, height: (rect.height / window.innerHeight) * 100 };
    };

    const positionOf = (element: HudElementDefinition): HudPosition => {
        const saved = draft[element.id];

        if (saved) {
            return saved;
        }

        return clampPosition(
            element.anchor,
            measuredSize(element),
            defaultPosition(element.id, element.id === 'minimap' ? rawMinimap : minimap, hasStreetNames)
        );
    };

    const onMoveStart = (element: HudElementDefinition) => (event: ReactPointerEvent) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelected(element.id);
        drag.current = {
            kind: 'move',
            id: element.id,
            startX: event.clientX,
            startY: event.clientY,
            origin: positionOf(element),
            size: measuredSize(element),
        };
    };

    const onResizeStart = (element: HudElementDefinition) => (event: ReactPointerEvent) => {
        const node = blocks.current[element.id];

        if (!node) {
            return;
        }

        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelected(element.id);

        const [anchorX, anchorY] = anchorPoint(element.anchor, node.getBoundingClientRect());

        drag.current = {
            kind: 'resize',
            id: element.id,
            origin: positionOf(element),
            size: measuredSize(element),
            anchorX,
            anchorY,
            startDistance: Math.max(MIN_RESIZE_DISTANCE, Math.hypot(event.clientX - anchorX, event.clientY - anchorY)),
        };
    };

    const onPointerMove = (element: HudElementDefinition) => (event: ReactPointerEvent) => {
        const state = drag.current;

        if (!state || state.id !== element.id) {
            return;
        }

        if (state.kind === 'move') {
            const dx = ((event.clientX - state.startX) / window.innerWidth) * 100;
            const dy = ((event.clientY - state.startY) / window.innerHeight) * 100;

            setDraft((current) => ({
                ...current,
                [element.id]: clampPosition(element.anchor, state.size, {
                    ...state.origin,
                    x: state.origin.x + dx,
                    y: state.origin.y + dy,
                }),
            }));

            return;
        }

        const startScale = state.origin.scale ?? 1;
        const distance = Math.hypot(event.clientX - state.anchorX, event.clientY - state.anchorY);
        const scale = clampScale((startScale * distance) / state.startDistance);
        const ratio = scale / startScale;

        setDraft((current) => ({
            ...current,
            [element.id]: clampPosition(
                element.anchor,
                { width: state.size.width * ratio, height: state.size.height * ratio },
                { ...state.origin, scale }
            ),
        }));
    };

    const onPointerUp = () => {
        drag.current = null;
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 select-none bg-black/60 font-prompt text-white" style={{ zIndex: 200 }}>
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: '5vw 5vh',
                }}
            />

            {HUD_ELEMENTS.map((element) => {
                const position = positionOf(element);
                const scale = position.scale ?? 1;
                const moved = Boolean(draft[element.id]);
                const active = selected === element.id || hovered === element.id;

                if (element.id === 'minimap') {
                    const box = boxFor(element.anchor, fixedSize(element), position);
                    const size = fixedSize(element);

                    return (
                        <div
                            key={element.id}
                            onPointerDown={onMoveStart(element)}
                            onPointerMove={onPointerMove(element)}
                            onPointerUp={onPointerUp}
                            className={classNames(
                                'absolute flex cursor-move items-center justify-center rounded-[1vh] border-2 border-dashed text-[1.6vh] font-semibold',
                                moved ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/60 bg-white/10'
                            )}
                            style={{
                                left: `${box.left}vw`,
                                top: `${box.top}vh`,
                                width: `${size.width}vw`,
                                height: `${size.height}vh`,
                            }}
                        >
                            {element.label}
                        </div>
                    );
                }

                return (
                    <div
                        key={element.id}
                        ref={(node) => {
                            blocks.current[element.id] = node;
                        }}
                        onPointerDown={onMoveStart(element)}
                        onPointerMove={onPointerMove(element)}
                        onPointerUp={onPointerUp}
                        onPointerEnter={() => setHovered(element.id)}
                        onPointerLeave={() => setHovered((current) => (current === element.id ? null : current))}
                        className="absolute cursor-move"
                        style={blockStyle(element.anchor, position)}
                    >
                        <div className="pointer-events-none">
                            <HudPreview id={element.id} />
                        </div>

                        {active && (
                            <>
                                <div
                                    className={classNames('pointer-events-none absolute inset-0 border-dashed', {
                                        'border-emerald-400': moved,
                                        'border-white/80': !moved,
                                    })}
                                    style={{ borderWidth: `${OUTLINE_WIDTH / scale}px` }}
                                />
                                <div
                                    className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-br bg-black/80 px-[0.8vh] py-[0.3vh] text-[1.4vh] font-semibold"
                                    style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top left' }}
                                >
                                    {element.label} · {Math.round(scale * 100)} %
                                </div>
                                {CORNERS.map((corner) => (
                                    <div
                                        key={corner.id}
                                        onPointerDown={onResizeStart(element)}
                                        className="absolute rounded-sm border border-black bg-white"
                                        style={{
                                            left: corner.left,
                                            top: corner.top,
                                            width: `${HANDLE_SIZE / scale}px`,
                                            height: `${HANDLE_SIZE / scale}px`,
                                            transform: 'translate(-50%, -50%)',
                                            cursor:
                                                corner.id === 'top-left' || corner.id === 'bottom-right'
                                                    ? 'nwse-resize'
                                                    : 'nesw-resize',
                                        }}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                );
            })}

            <div className="absolute bottom-[10vh] left-1/2 flex -translate-x-1/2 items-center gap-[1.4vh] rounded-[1.2vh] bg-black/80 px-[2vh] py-[1.2vh]">
                <span className="text-[1.5vh] text-white/70">
                    Glisse les blocs pour les placer, et leurs coins pour les redimensionner
                </span>
                <button
                    onClick={reset}
                    className="rounded-[0.8vh] bg-white/15 px-[1.6vh] py-[0.6vh] text-[1.4vh] font-semibold hover:bg-white/30"
                >
                    Réinitialiser
                </button>
                <button
                    onClick={cancel}
                    className="rounded-[0.8vh] bg-white/15 px-[1.6vh] py-[0.6vh] text-[1.4vh] font-semibold hover:bg-white/30"
                >
                    Annuler
                </button>
                <button
                    onClick={save}
                    className="rounded-[0.8vh] bg-lime-500 px-[1.6vh] py-[0.6vh] text-[1.4vh] font-semibold text-black hover:bg-lime-400"
                >
                    Valider
                </button>
            </div>
        </div>
    );
};
