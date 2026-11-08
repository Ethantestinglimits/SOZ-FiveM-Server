import { ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon, XIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import {
    FunctionComponent,
    PointerEvent as ReactPointerEvent,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { NuiEvent } from '../../../../../shared/event';
import { HUD_ELEMENTS, HudAnchorTarget, HudElementId, HudLayout } from '../../../../../shared/nui/hud_layout';
import { PauseMenuData } from '../../../../../shared/nui/pause_menu';
import { fetchNui } from '../../../../fetch';
import { store } from '../../../../store';
import { getScreenFrame } from '../../../../utils/screenFrame';
import { getHudCornerPoint, getHudLayout, HudRect, resolveTargetRect, setHudLayout } from '../../../Hud/hudPlacement';
import { setHudEditing, setHudPreview } from '../../../Hud/hudPreview';
import { minimapController } from '../../../Minimap/minimapState';
import { openPauseTab } from '../../pauseTabs';
import { MinimapPanel } from '../../settings/MinimapPanel';
import {
    absolutePlacement,
    anchorFor,
    BlockRects,
    clampScale,
    dropLayout,
    EDITABLE,
    Guides,
    nudge,
    readBlockRects,
    snapRect,
} from './editing';

type Situation = {
    vehicle: boolean;
    weapon: boolean;
    watch: boolean;
    minimapHidden: boolean;
    notification: boolean;
    police: boolean;
    progress: boolean;
    instructions: boolean;
};

const SITUATIONS: { id: keyof Situation; label: string }[] = [
    { id: 'vehicle', label: 'En véhicule' },
    { id: 'weapon', label: 'Arme en main' },
    { id: 'watch', label: 'Smartwatch' },
    { id: 'minimapHidden', label: 'Minimap cachée' },
    { id: 'notification', label: 'Notification' },
    { id: 'police', label: 'Alerte police' },
    { id: 'progress', label: 'Progression' },
    { id: 'instructions', label: 'Aide' },
];

const NOTIFICATION_ID = 'hud-editor-notification';
const POLICE_ID = 'hud-editor-police';
const LONG_DELAY = 3600000;
const FINE_STEP = 0.1;
const LARGE_STEP = 1;
const SCALE_STEP = 0.05;

const targetLabel = (target: HudAnchorTarget): string =>
    target === 'frame'
        ? 'bord du cadre 16:9'
        : target === 'screen'
          ? 'bord de l’écran'
          : HUD_ELEMENTS.find(element => element.id === target)?.label ?? target;

const WATCH_DISPLAYS: { id: string; label: string; default: boolean }[] = [
    { id: 'watchDateTime', label: 'Date et heure', default: true },
    { id: 'watchWeather', label: 'Météo', default: true },
    { id: 'watchStreetName', label: 'Noms de rue', default: true },
    { id: 'watchCompass', label: 'Boussole', default: true },
    { id: 'watchStress', label: 'Stress', default: true },
    { id: 'watchStamina', label: 'Endurance', default: true },
    { id: 'watchAnimalStats', label: 'État de l’animal', default: true },
    { id: 'watchInjuryTracker', label: 'État corporel', default: false },
    { id: 'hudCompassLeft', label: 'Boussole à gauche', default: false },
    { id: 'hudStreetOnTop', label: 'Rue en haut', default: false },
];

const NO_GUIDES: Guides = { x: [], y: [] };

const send = (app: string, method: string, data?: unknown): void => {
    window.postMessage({ app, method, data }, '*');
};

const initialSituation = (): Situation => {
    const state = store.getState();

    return {
        vehicle: state.vehicle.seat !== null && state.vehicle.seat !== undefined,
        weapon: Boolean(state.hud.ammo?.hasWeapon),
        watch: Boolean(state.hud.hasWatch),
        minimapHidden: Boolean(state.hud.minimap?.isHidden),
        notification: false,
        police: false,
        progress: false,
        instructions: false,
    };
};

const Section: FunctionComponent<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <div className="flex shrink-0 flex-col gap-[0.5vh]">
        <span className="text-[1.1vh] font-semibold uppercase tracking-[0.2em] text-white/45">{title}</span>
        {children}
    </div>
);

const useBlockRects = (): BlockRects => {
    const [rects, setRects] = useState<BlockRects>({});

    useEffect(() => {
        let frameId = 0;
        let last = '';

        const loop = () => {
            const next = readBlockRects();
            const key = JSON.stringify(next);

            if (key !== last) {
                last = key;
                setRects(next);
            }

            frameId = requestAnimationFrame(loop);
        };

        loop();

        return () => cancelAnimationFrame(frameId);
    }, []);

    return rects;
};

type Drag = {
    id: HudElementId;
    moved: boolean;
    last: HudRect | null;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
};

export const HudEditorTab: FunctionComponent<{ data: PauseMenuData }> = ({ data }) => {
    const [situation, setSituation] = useState<Situation>(initialSituation);
    const [collapsed, setCollapsed] = useState(false);
    const [selected, setSelected] = useState<HudElementId | null>(null);
    const [guides, setGuides] = useState<Guides>(NO_GUIDES);
    const [panel, setPanel] = useState(() => ({ x: window.innerHeight * 0.02, y: window.innerHeight * 0.02 }));
    const frame = useMemo(() => getScreenFrame(), []);
    const rects = useBlockRects();
    const original = useRef<HudLayout>(getHudLayout());
    const draft = useRef<HudLayout>(getHudLayout());
    const rectsRef = useRef(rects);
    const drag = useRef<Drag | null>(null);
    const panelDrag = useRef<{ x: number; y: number } | null>(null);

    rectsRef.current = rects;

    const [, refresh] = useState(0);

    const commit = useCallback((next: HudLayout) => {
        draft.current = next;
        setHudLayout(next);
        refresh(value => value + 1);
    }, []);

    const setScale = (id: HudElementId, value: number) => {
        const layout = draft.current;
        const rect = rectsRef.current[id];
        const placement = layout[id] ?? (rect ? anchorFor(id, rect, layout, rectsRef.current) : null);

        if (placement) {
            commit({ ...layout, [id]: { ...placement, scale: clampScale(value) } });
        }
    };

    useEffect(() => {
        setHudPreview({
            hud: {
                hasWatch: () => situation.watch,
                ammo: real => ({
                    ammo: 24,
                    maxAmmo: 120,
                    ...(real as object),
                    hasWeapon: situation.weapon,
                }),
                minimap: real => ({ ...(real as object), isHidden: situation.minimapHidden }),
            },
            vehicle: {
                seat: () => (situation.vehicle ? -1 : null),
            },
        });
        minimapController.renderer?.preview(!situation.minimapHidden);
    }, [situation.watch, situation.weapon, situation.minimapHidden, situation.vehicle]);

    useEffect(() => {
        if (situation.notification) {
            send('hud', 'DrawNotification', {
                id: NOTIFICATION_ID,
                message: 'Exemple de notification pour placer le bloc.',
                style: 'info',
                delay: LONG_DELAY,
            });
        } else {
            send('hud', 'CancelNotification', NOTIFICATION_ID);
        }
    }, [situation.notification]);

    useEffect(() => {
        if (situation.police) {
            send('hud', 'DrawNotification', {
                id: POLICE_ID,
                message: 'Exemple d’alerte police.',
                style: 'info',
                delay: LONG_DELAY,
                title: 'Central',
                policeStyle: 'default',
                hour: '12:00',
                logo: 'lspd',
                notificationId: 0,
            });
        } else {
            send('hud', 'CancelNotification', POLICE_ID);
        }
    }, [situation.police]);

    useEffect(() => {
        if (situation.progress) {
            send('progress', 'Start', { label: 'Exemple de progression', duration: LONG_DELAY, units: [] });
        } else {
            send('progress', 'Stop');
        }
    }, [situation.progress]);

    useEffect(() => {
        send('hud', 'SetInstructional', situation.instructions ? ['~INPUT_CONTEXT~ Exemple d’aide'] : []);
        send('hud', 'ForceDisplayInstructional', situation.instructions);
    }, [situation.instructions]);

    useEffect(() => {
        setHudEditing(true);
    }, []);

    useEffect(
        () => () => {
            setHudLayout(original.current);
            setHudEditing(false);
            setHudPreview(null);
            minimapController.renderer?.preview(null);
            send('hud', 'CancelNotification', NOTIFICATION_ID);
            send('hud', 'CancelNotification', POLICE_ID);
            send('progress', 'Stop');
            send('hud', 'SetInstructional', []);
            send('hud', 'ForceDisplayInstructional', false);
        },
        []
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopImmediatePropagation();

                if (selected) {
                    setSelected(null);
                } else {
                    openPauseTab('settings');
                }

                return;
            }

            const direction: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
            };
            const move = direction[event.key];

            if (!move || !selected) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            const layout = draft.current;
            const rect = rectsRef.current[selected];
            const placement = layout[selected] ?? (rect ? anchorFor(selected, rect, layout, rectsRef.current) : null);

            if (!placement) {
                return;
            }

            const step = event.shiftKey ? LARGE_STEP : FINE_STEP;

            commit({ ...layout, [selected]: nudge(placement, move[0] * step, move[1] * step) });
        };

        window.addEventListener('keydown', onKeyDown, true);

        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [selected, commit]);

    const startDrag = (id: HudElementId, event: ReactPointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        setSelected(id);

        const rect = rectsRef.current[id];

        if (!rect || event.button !== 0) {
            return;
        }

        drag.current = { id, moved: false, last: null, startX: event.clientX, startY: event.clientY, ...rect };

        const onMove = (move: PointerEvent) => moveDrag(move);
        const onUp = () => {
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointercancel', onUp, true);
            endDrag();
        };

        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
    };

    const moveDrag = (event: PointerEvent) => {
        const current = drag.current;

        if (!current) {
            return;
        }

        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;

        if (!current.moved && Math.hypot(dx, dy) < 3) {
            return;
        }

        current.moved = true;

        const layout = draft.current;
        const raw = { x: current.x + dx, y: current.y + dy, w: current.w, h: current.h };
        const snapped = event.altKey
            ? { rect: raw, guides: { x: [], y: [] } }
            : snapRect(current.id, raw, layout, rectsRef.current);
        current.last = snapped.rect;
        setGuides(snapped.guides);
        commit({
            ...layout,
            [current.id]:
                anchorFor(current.id, snapped.rect, layout, rectsRef.current) ??
                absolutePlacement(snapped.rect, layout[current.id]),
        });
    };

    const endDrag = () => {
        const current = drag.current;

        if (current?.last) {
            commit(dropLayout(current.id, current.last, draft.current, rectsRef.current));
        }

        drag.current = null;
        setGuides(NO_GUIDES);
    };

    const startPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
            return;
        }

        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        panelDrag.current = { x: event.clientX - panel.x, y: event.clientY - panel.y };
    };

    const movePanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        const offset = panelDrag.current;

        if (!offset) {
            return;
        }

        setPanel({
            x: Math.max(0, Math.min(window.innerWidth - 80, event.clientX - offset.x)),
            y: Math.max(0, Math.min(window.innerHeight - 40, event.clientY - offset.y)),
        });
    };

    const endPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (panelDrag.current) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        panelDrag.current = null;
    };

    const selectedPlacement = selected ? draft.current[selected] : undefined;
    const selectedRect = selected ? rects[selected] : undefined;
    const selectedScale = selectedPlacement?.scale ?? 1;
    const anchorRect = selectedPlacement ? resolveTargetRect(selectedPlacement.target) : null;
    const link =
        selectedPlacement && selectedRect && anchorRect
            ? {
                  from: getHudCornerPoint(anchorRect, selectedPlacement.targetCorner),
                  to: getHudCornerPoint(selectedRect, selectedPlacement.corner),
              }
            : null;

    return (
        <div
            className="pointer-events-auto absolute inset-0 select-none font-prompt text-white"
            onPointerDown={() => setSelected(null)}
        >
            <div
                className="pointer-events-none absolute inset-y-0 border-x-2 border-dashed border-white/25"
                style={{ left: frame.x, width: frame.w }}
            />

            {anchorRect && selectedPlacement && selectedPlacement.target !== 'screen' && (
                <div
                    className="pointer-events-none absolute rounded-[0.4vh] border border-dashed border-amber-300/80"
                    style={{ left: anchorRect.x, top: anchorRect.y, width: anchorRect.w, height: anchorRect.h }}
                />
            )}

            {EDITABLE.map(element => {
                const rect = rects[element.id];

                if (!rect) {
                    return null;
                }

                const active = selected === element.id;

                return (
                    <div
                        key={element.id}
                        onPointerDown={event => startDrag(element.id, event)}
                        onWheel={event => {
                            if (active) {
                                setScale(
                                    element.id,
                                    (draft.current[element.id]?.scale ?? 1) - Math.sign(event.deltaY) * SCALE_STEP
                                );
                            }
                        }}
                        className={classNames('group absolute cursor-move rounded-[0.4vh]', {
                            'border-2 border-sky-400 bg-sky-400/10': active,
                            'border border-white/30 hover:border-white/70 hover:bg-white/5': !active,
                        })}
                        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                    >
                        <span
                            className={classNames(
                                'pointer-events-none absolute bottom-full left-0 mb-[0.3vh] whitespace-nowrap rounded-[0.4vh] px-[0.6vh] py-[0.1vh] text-[1.1vh] font-semibold',
                                {
                                    'bg-sky-500': active,
                                    'hidden bg-black/70 group-hover:block': !active,
                                }
                            )}
                        >
                            {element.label}
                        </span>
                    </div>
                );
            })}

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {guides.x.map(x => (
                    <line key={`x${x}`} x1={x} x2={x} y1={0} y2="100%" stroke="#f472b6" strokeWidth={1} />
                ))}
                {guides.y.map(y => (
                    <line key={`y${y}`} y1={y} y2={y} x1={0} x2="100%" stroke="#f472b6" strokeWidth={1} />
                ))}
                {link && (
                    <>
                        <line
                            x1={link.from[0]}
                            y1={link.from[1]}
                            x2={link.to[0]}
                            y2={link.to[1]}
                            stroke="#fcd34d"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                        />
                        <circle cx={link.from[0]} cy={link.from[1]} r={4} fill="#fcd34d" />
                        <circle cx={link.to[0]} cy={link.to[1]} r={4} fill="#38bdf8" />
                    </>
                )}
            </svg>

            <aside
                onPointerDown={event => event.stopPropagation()}
                className="absolute flex max-h-[85vh] w-[34vh] flex-col gap-[1.6vh] rounded-2xl bg-[#16171cf2] p-[1.6vh] shadow-xl"
                style={{ left: panel.x, top: panel.y }}
            >
                <div
                    onPointerDown={startPanelDrag}
                    onPointerMove={movePanelDrag}
                    onPointerUp={endPanelDrag}
                    onPointerCancel={endPanelDrag}
                    className="flex cursor-grab items-center gap-[1vh] active:cursor-grabbing"
                >
                    <span className="flex-1 text-[1.8vh] font-bold">Éditeur d’ATH</span>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="h-[3vh] w-[3vh] rounded-[0.6vh] bg-white/10 p-[0.5vh] hover:bg-white/25"
                    >
                        {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                    </button>
                </div>

                {!collapsed && (
                    <div className="-mr-[0.8vh] flex min-h-0 flex-col gap-[1.6vh] overflow-y-auto pr-[0.8vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                        <Section title="Situation">
                            <div className="flex flex-wrap gap-[0.6vh]">
                                {SITUATIONS.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setSituation({ ...situation, [item.id]: !situation[item.id] })}
                                        className={classNames(
                                            'rounded-full px-[1.2vh] py-[0.5vh] text-[1.35vh] font-semibold transition-colors',
                                            {
                                                'bg-emerald-600 text-white': situation[item.id],
                                                'bg-white/10 text-white/60 hover:bg-white/20': !situation[item.id],
                                            }
                                        )}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </Section>

                        {selected && (
                            <Section title={EDITABLE.find(element => element.id === selected)?.label ?? ''}>
                                <div className="flex items-center gap-[1vh] rounded-[0.8vh] bg-white/5 px-[1.2vh] py-[0.6vh] text-[1.4vh] font-semibold">
                                    <span className="flex-1">Taille</span>
                                    <button
                                        onClick={() => setScale(selected, selectedScale - SCALE_STEP)}
                                        className="h-[2.6vh] w-[2.6vh] rounded-[0.5vh] bg-white/10 p-[0.4vh] hover:bg-white/25"
                                    >
                                        <MinusIcon />
                                    </button>
                                    <span className="w-[5vh] text-center">{Math.round(selectedScale * 100)} %</span>
                                    <button
                                        onClick={() => setScale(selected, selectedScale + SCALE_STEP)}
                                        className="h-[2.6vh] w-[2.6vh] rounded-[0.5vh] bg-white/10 p-[0.4vh] hover:bg-white/25"
                                    >
                                        <PlusIcon />
                                    </button>
                                </div>
                                <span className="px-[0.4vh] text-[1.25vh] text-white/60">
                                    Accroché à :{' '}
                                    {selectedPlacement ? targetLabel(selectedPlacement.target) : 'position par défaut'}
                                </span>
                            </Section>
                        )}

                        <Section title="Blocs">
                            <div className="flex max-h-[30vh] flex-col gap-[0.4vh] overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                                {EDITABLE.map(element => {
                                    const noWatch = element.watch && !situation.watch;
                                    const shown = Boolean(rects[element.id]);

                                    return (
                                        <button
                                            key={element.id}
                                            onClick={() => setSelected(element.id)}
                                            className={classNames(
                                                'flex shrink-0 items-center rounded-[0.6vh] px-[1.2vh] py-[0.6vh] text-left text-[1.4vh] font-semibold',
                                                {
                                                    'bg-sky-500/40': selected === element.id,
                                                    'bg-white/5 hover:bg-white/15': selected !== element.id,
                                                    'text-white/45': noWatch || !shown,
                                                }
                                            )}
                                        >
                                            <span className="flex-1">{element.label}</span>
                                            {(noWatch || !shown) && (
                                                <span className="text-[1.2vh] font-normal">
                                                    {noWatch ? 'pas de smartwatch' : 'non affiché'}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>

                        <Section title="Affichage de la montre">
                            <div className="flex flex-wrap gap-[0.6vh]">
                                {WATCH_DISPLAYS.map(item => {
                                    const value = Boolean(data.settings.server[item.id] ?? item.default);

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() =>
                                                fetchNui(NuiEvent.PauseMenuSetSetting, { key: item.id, value: !value })
                                            }
                                            className={classNames(
                                                'rounded-full px-[1.2vh] py-[0.5vh] text-[1.35vh] font-semibold transition-colors',
                                                {
                                                    'bg-emerald-600 text-white': value,
                                                    'bg-white/10 text-white/60 hover:bg-white/20': !value,
                                                }
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {!situation.watch && (
                                <span className="text-[1.2vh] text-white/50">
                                    Active la situation Smartwatch pour voir ces éléments.
                                </span>
                            )}
                        </Section>

                        <div className="flex flex-col gap-[0.3vh] text-[1.25vh] text-white/60">
                            <span>Glisser : déplacer et accrocher</span>
                            <span>Flèches : ajuster (Maj : plus vite)</span>
                            <span>Molette sur le bloc : taille</span>
                            <span>Alt en glissant : sans guides</span>
                        </div>

                        <button
                            onClick={() => openPauseTab('settings')}
                            className="flex shrink-0 items-center justify-center gap-[0.8vh] rounded-[0.8vh] bg-white/10 py-[0.9vh] text-[1.4vh] font-semibold hover:bg-white/25"
                        >
                            <XIcon className="h-[1.8vh] w-[1.8vh]" />
                            Quitter l’éditeur
                        </button>
                    </div>
                )}
            </aside>

            {selected === 'minimap' && !collapsed && (
                <aside
                    onPointerDown={event => event.stopPropagation()}
                    className="absolute flex max-h-[85vh] w-[48vh] flex-col gap-[1.2vh] rounded-2xl bg-[#16171cf2] p-[1.6vh] shadow-xl"
                    style={{ left: panel.x + window.innerHeight * 0.36, top: panel.y }}
                >
                    <span className="text-[1.8vh] font-bold">Apparence de la Minimap</span>
                    <div className="min-h-0 overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                        <MinimapPanel compact />
                    </div>
                </aside>
            )}
        </div>
    );
};
