import classNames from 'classnames';
import { FunctionComponent, PointerEvent as ReactPointerEvent, useRef, useState } from 'react';

import { NuiEvent } from '../../../shared/event';
import {
    HUD_ELEMENTS,
    HudElementDefinition,
    HudElementId,
    HudLayout,
    HudPosition,
} from '../../../shared/nui/hud_layout';
import { Minimap } from '../../../shared/hud';
import { fetchNui } from '../../fetch';
import { useKeyPress } from '../../hook/control';
import { useMinimap } from '../../hook/data';
import { useNuiEvent, useNuiFocus } from '../../hook/nui';
import { setHudLayout, shiftMinimap } from './hudLayoutState';

const SNAP = 1;

const snap = (value: number) => Math.round(value / SNAP) * SNAP;

const defaultPosition = (id: HudElementId, minimap: Minimap): HudPosition => {
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
    }
};

const boxFor = (element: HudElementDefinition, position: HudPosition) => {
    switch (element.anchor) {
        case 'bottom-left':
            return { left: position.x, top: position.y - element.height };
        case 'top-center':
            return { left: position.x - element.width / 2, top: position.y };
        case 'top-right':
            return { left: position.x - element.width, top: position.y };
    }
};

const clampPosition = (element: HudElementDefinition, position: HudPosition): HudPosition => {
    const box = boxFor(element, position);
    const dx = Math.min(0, 100 - element.width - box.left) + Math.max(0, -box.left);
    const dy = Math.min(0, 100 - element.height - box.top) + Math.max(0, -box.top);

    return { x: snap(position.x + dx), y: snap(position.y + dy) };
};

type DragState = { id: HudElementId; startX: number; startY: number; origin: HudPosition };

export const HudEditor: FunctionComponent = () => {
    const rawMinimap = useMinimap();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<HudLayout>({});
    const minimap = shiftMinimap(rawMinimap, draft.minimap);

    const resolve = (element: HudElementDefinition): HudElementDefinition =>
        element.id === 'minimap'
            ? {
                  ...element,
                  width: rawMinimap.width * 100 || element.width,
                  height: rawMinimap.height * 100 || element.height,
              }
            : element;
    const drag = useRef<DragState | null>(null);

    useNuiFocus(open, open, false);

    useNuiEvent('hud_layout', 'OpenEditor', (layout) => {
        setDraft(layout);
        setOpen(true);
    });

    const cancel = () => setOpen(false);

    const save = () => {
        fetchNui(NuiEvent.HudLayoutSave, draft);
        setOpen(false);
    };

    const reset = () => {
        setDraft({});
        setHudLayout({});
        fetchNui(NuiEvent.HudLayoutReset);
    };

    useKeyPress('Escape', () => {
        if (open) {
            cancel();
        }
    });

    const positionOf = (element: HudElementDefinition): HudPosition =>
        draft[element.id] ??
        clampPosition(
            element,
            defaultPosition(element.id, element.id === 'minimap' ? rawMinimap : minimap)
        );

    const onPointerDown = (item: HudElementDefinition) => (event: ReactPointerEvent) => {
        const element = resolve(item);

        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            id: element.id,
            startX: event.clientX,
            startY: event.clientY,
            origin: positionOf(element),
        };
    };

    const onPointerMove = (item: HudElementDefinition) => (event: ReactPointerEvent) => {
        const element = resolve(item);
        const state = drag.current;

        if (!state || state.id !== element.id) {
            return;
        }

        const dx = ((event.clientX - state.startX) / window.innerWidth) * 100;
        const dy = ((event.clientY - state.startY) / window.innerHeight) * 100;

        setDraft((current) => ({
            ...current,
            [element.id]: clampPosition(element, { x: state.origin.x + dx, y: state.origin.y + dy }),
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

            {HUD_ELEMENTS.map((item) => {
                const element = resolve(item);
                const box = boxFor(element, positionOf(element));

                return (
                    <div
                        key={element.id}
                        onPointerDown={onPointerDown(element)}
                        onPointerMove={onPointerMove(element)}
                        onPointerUp={onPointerUp}
                        className={classNames(
                            'absolute flex cursor-move items-center justify-center rounded-[1vh] border-2 border-dashed text-[1.6vh] font-semibold',
                            draft[element.id] ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/60 bg-white/10',
                        )}
                        style={{
                            left: `${box.left}vw`,
                            top: `${box.top}vh`,
                            width: `${element.width}vw`,
                            height: `${element.height}vh`,
                        }}
                    >
                        {element.label}
                    </div>
                );
            })}

            <div className="absolute left-1/2 top-[3vh] flex -translate-x-1/2 items-center gap-[1.4vh] rounded-[1.2vh] bg-black/80 px-[2vh] py-[1.2vh]">
                <span className="text-[1.5vh] text-white/70">Glisse les cadres pour placer le HUD</span>
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
