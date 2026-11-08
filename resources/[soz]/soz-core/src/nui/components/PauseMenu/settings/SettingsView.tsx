import {
    AdjustmentsIcon,
    CameraIcon,
    ChatAlt2Icon,
    CursorClickIcon,
    DesktopComputerIcon,
    LocationMarkerIcon,
    MapIcon,
    MenuIcon,
    MicrophoneIcon,
    MusicNoteIcon,
    SearchIcon,
    SparklesIcon,
    ViewGridIcon,
    VolumeUpIcon,
} from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useMemo, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import { isNativeSetting, NATIVE_SETTINGS } from '../../../../shared/nui/native_settings';
import { PauseSettingsData } from '../../../../shared/nui/pause_settings';
import { fetchNui } from '../../../fetch';
import { setVolumes } from '../../../utils/volumes';
import { inputNavKeyDown, NAV_SKIP_ATTRIBUTE } from '../keyboardNav';
import { ServerSliderSetting, SETTING_CATEGORIES, SettingCategory, SettingItem, SOZ_CATEGORY_IDS } from './definitions';
import { GraphicsPanel } from './GraphicsPanel';
import { KeysPanel } from './KeysPanel';
import { MinimapPanel } from './MinimapPanel';
import { setNativeHover } from './nativeInputState';
import { PendingApply, usePendingApply, usePublishPendingApply } from './pendingApply';
import { Arrow, Bar, ROW_CLASS, ROW_LABEL_CLASS, ToggleButton, ValueStepper } from './rowControls';

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type SettingsSidebarProps = {
    category: string;
    onCategoryChange: (category: string) => void;
};

const KeyboardIcon: FunctionComponent = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path strokeLinecap="round" d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
);

const CATEGORY_ICONS: Record<string, ReactNode> = {
    map: <MapIcon />,
    minimap: <LocationMarkerIcon />,
    hud: <ViewGridIcon />,
    menus: <MenuIcon />,
    voip: <MicrophoneIcon />,
    sounds: <MusicNoteIcon />,
    volume: <VolumeUpIcon />,
    display: <DesktopComputerIcon />,
    graphics: <SparklesIcon />,
    graphicsAdvanced: <AdjustmentsIcon />,
    controls: <CursorClickIcon />,
    camera: <CameraIcon />,
    voice: <ChatAlt2Icon />,
    keys: <KeyboardIcon />,
};

const isSoz = (category: SettingCategory) => SOZ_CATEGORY_IDS.includes(category.id);

export const SettingsSidebar: FunctionComponent<SettingsSidebarProps> = ({ category, onCategoryChange }) => {
    const pending = usePendingApply();

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-[1vh] py-[2.4vh]">
            <ul className="flex min-h-0 flex-1 flex-col gap-[0.5vh] overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                {SETTING_CATEGORIES.map((item, index) => (
                    <li key={item.id}>
                        {(index === 0 || isSoz(item) !== isSoz(SETTING_CATEGORIES[index - 1])) && (
                            <div
                                className={classNames(
                                    'px-[0.4vh] pb-[0.6vh] text-[1.1vh] font-semibold uppercase tracking-[0.2em] text-white/45',
                                    { 'pt-[1.4vh]': index > 0 }
                                )}
                            >
                                {isSoz(item) ? 'SoZ' : 'Jeu'}
                            </div>
                        )}
                        <button
                            onClick={() => onCategoryChange(item.id)}
                            className={classNames(
                                'flex w-full items-center gap-[1vh] rounded-[0.8vh] py-[0.95vh] px-[1.4vh] text-left text-[1.45vh] font-semibold transition-colors',
                                {
                                    'bg-white text-black': category === item.id,
                                    'bg-white/5 text-white/85 hover:bg-white/15 hover:text-white': category !== item.id,
                                }
                            )}
                        >
                            <span className="h-[1.9vh] w-[1.9vh] shrink-0">{CATEGORY_ICONS[item.id]}</span>
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
            {pending && <PendingActions pending={pending} />}
        </div>
    );
};

const PendingActions: FunctionComponent<{ pending: PendingApply }> = ({ pending }) => {
    const native = pending.native
        ? {
              onMouseEnter: () => setNativeHover(true),
              onMouseLeave: () => setNativeHover(false),
              onFocus: () => setNativeHover(true),
              onBlur: () => setNativeHover(false),
              onMouseDown: pending.apply,
          }
        : { onClick: pending.apply };

    return (
        <div className="flex shrink-0 flex-col gap-[0.6vh]">
            <button
                disabled={pending.busy}
                {...native}
                className="rounded-[0.8vh] bg-emerald-500/80 px-[1.4vh] py-[0.95vh] text-[1.4vh] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-default disabled:bg-white/10 disabled:text-white/40"
            >
                {pending.busy ? 'Application…' : `${pending.label} (${pending.count})`}
            </button>
            {pending.cancel && (
                <button
                    onClick={pending.cancel}
                    className="rounded-[0.8vh] bg-white/10 px-[1.4vh] py-[0.95vh] text-[1.4vh] font-semibold transition-colors hover:bg-white/25"
                >
                    Annuler les changements
                </button>
            )}
        </div>
    );
};

type SettingRowProps = {
    item: SettingItem;
    settings: PauseSettingsData;
    onHover: (item: SettingItem | null) => void;
    draft?: number;
    onDraft?: (key: string, value: number) => void;
};

const SliderControl: FunctionComponent<{
    item: ServerSliderSetting;
    value: number;
    onCommit: (value: number) => void;
    onStep: (direction: number) => void;
}> = ({ item, value, onCommit, onStep }) => {
    const [current, setCurrent] = useState(value);

    useEffect(() => setCurrent(value), [value]);

    const percent = ((current - item.min) / (item.max - item.min)) * 100;

    return (
        <div className="flex items-center gap-[1vh]">
            <Arrow direction={-1} onPress={() => onStep(-1)} />
            <input
                type="range"
                tabIndex={-1}
                min={item.min}
                max={item.max}
                step={1}
                value={current}
                onChange={event => {
                    const next = Number(event.currentTarget.value);

                    setCurrent(next);

                    if (item.channel) {
                        setVolumes({ [item.channel]: next / 100 });
                    }
                }}
                onPointerUp={event => onCommit(Number(event.currentTarget.value))}
                className="soz-volume-slider w-[16vh]"
                style={{
                    background: `linear-gradient(to right, #fff ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`,
                }}
            />
            <span className="min-w-[4.6vh] text-right text-[1.45vh] font-semibold tabular-nums">{current}%</span>
            <Arrow direction={1} onPress={() => onStep(1)} />
        </div>
    );
};

const SettingRow: FunctionComponent<SettingRowProps> = ({ item, settings, onHover, draft, onDraft }) => {
    let control;
    let adjust: ((direction: number) => void) | undefined;
    let activate: (() => void) | undefined;
    let keepsInput = false;
    const rawNative = item.kind === 'native' ? settings.native[item.convar] : undefined;
    const [typed, setTyped] = useState<number | undefined>(undefined);

    useEffect(() => setTyped(undefined), [rawNative]);

    if (item.kind === 'action') {
        const run = () =>
            item.event ? fetchNui(item.event) : fetchNui(NuiEvent.PauseMenuSetSetting, { key: item.id, value: true });

        activate = run;
        control = (
            <button
                onClick={run}
                className="rounded-[0.8vh] bg-white/15 px-[1.4vh] py-[0.4vh] text-[1.4vh] font-semibold text-white transition-colors hover:bg-white/30"
            >
                {item.button}
            </button>
        );
    } else if (item.kind === 'select') {
        const current = settings.server[item.id] ?? item.default;
        const index = Math.max(
            0,
            item.options.findIndex(option => option.value === current)
        );
        const change = (direction: number) => {
            const next = item.options[(index + direction + item.options.length) % item.options.length];

            fetchNui(NuiEvent.PauseMenuSetSetting, { key: item.id, value: next.value });
        };

        adjust = change;

        control = (
            <ValueStepper
                label={item.options[index].label}
                index={index}
                count={item.options.length}
                onChange={change}
            />
        );
    } else if (item.kind === 'slider') {
        const current = Number(settings.server[item.id] ?? item.default);
        const commit = (value: number) => fetchNui(NuiEvent.PauseMenuSetSetting, { key: item.id, value });

        adjust = direction => {
            const next = Math.min(item.max, Math.max(item.min, current + direction * item.step));

            if (item.channel) {
                setVolumes({ [item.channel]: next / 100 });
            }

            commit(next);
        };
        control = <SliderControl item={item} value={current} onCommit={commit} onStep={adjust} />;
    } else if (item.kind === 'toggle') {
        const value = Boolean(settings.server[item.id] ?? item.default);
        const flip = () => fetchNui(NuiEvent.PauseMenuSetSetting, { key: item.id, value: !value });

        adjust = flip;
        activate = flip;
        control = <ToggleButton value={value} onPress={flip} />;
    } else {
        const raw = settings.native[item.convar];
        const native = NATIVE_SETTINGS[item.convar];

        if (native && raw !== undefined && raw >= 0) {
            const value = draft ?? typed ?? raw;
            const changed = value !== raw;
            const hover = onDraft
                ? {}
                : { onMouseEnter: () => setNativeHover(true), onMouseLeave: () => setNativeHover(false) };
            const queue = (next: number) => {
                if (onDraft) {
                    onDraft(item.convar, next);
                } else if (next !== raw) {
                    fetchNui(NuiEvent.PauseMenuQueueNative, { changes: [{ key: item.convar, value: next }] });
                }
            };
            const queueByKey = (next: number) => {
                if (onDraft) {
                    onDraft(item.convar, next);
                } else {
                    setTyped(next === raw ? undefined : next);
                }
            };

            keepsInput = !onDraft;
            activate = () => {
                if (!onDraft && typed !== undefined && typed !== raw) {
                    fetchNui(NuiEvent.PauseMenuQueueNative, { changes: [{ key: item.convar, value: typed }] });
                }
            };

            if (native.kind === 'toggle') {
                adjust = () => queueByKey(value > 0 ? 0 : 1);
                control = (
                    <ToggleButton
                        value={value > 0}
                        changed={changed}
                        mouseDown
                        hover={hover}
                        onPress={() => queue(value > 0 ? 0 : 1)}
                    />
                );
            } else {
                const label =
                    native.kind === 'select'
                        ? native.options.find(option => option.value === value)?.label ?? item.format(value)
                        : item.format(value);
                const step = (direction: number, apply: (next: number) => void) => {
                    if (native.kind === 'slider') {
                        apply(Math.min(native.max, Math.max(native.min, value + direction)));

                        return;
                    }

                    const index = Math.max(
                        0,
                        native.options.findIndex(option => option.value === value)
                    );

                    apply(native.options[(index + direction + native.options.length) % native.options.length].value);
                };
                const change = (direction: number) => step(direction, queue);

                adjust = direction => step(direction, queueByKey);

                if (native.kind === 'slider') {
                    const percent = ((value - native.min) / Math.max(1, native.max - native.min)) * 100;

                    control = (
                        <div className="flex items-center gap-[1vh]" {...hover}>
                            <Arrow direction={-1} onPress={() => change(-1)} mouseDown />
                            <Bar percent={percent} />
                            <span
                                className={classNames(
                                    'min-w-[4.6vh] text-right text-[1.45vh] font-semibold tabular-nums',
                                    { 'text-amber-300': changed }
                                )}
                            >
                                {label}
                            </span>
                            <Arrow direction={1} onPress={() => change(1)} mouseDown />
                        </div>
                    );
                } else {
                    const index = native.options.findIndex(option => option.value === value);

                    control = (
                        <ValueStepper
                            label={label}
                            index={index}
                            count={native.options.length}
                            changed={changed}
                            mouseDown
                            hover={hover}
                            onChange={change}
                        />
                    );
                }
            }
        } else {
            control = (
                <span className="rounded-[0.8vh] bg-white/10 px-[1.4vh] py-[0.4vh] text-[1.4vh] font-semibold text-white/80">
                    {raw === undefined || raw < 0 ? '—' : item.format(raw)}
                </span>
            );
        }
    }

    const onKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === 'ArrowLeft' && adjust) {
            event.preventDefault();
            adjust(-1);
        } else if (event.key === 'ArrowRight' && adjust) {
            event.preventDefault();
            adjust(1);
        } else if ((event.key === 'Enter' || event.key === ' ') && activate) {
            event.preventDefault();
            activate();
        }
    };

    return (
        <li
            tabIndex={0}
            onMouseEnter={() => onHover(item)}
            onFocus={() => {
                onHover(item);

                if (keepsInput) {
                    setNativeHover(true);
                }
            }}
            onBlur={() => {
                if (keepsInput) {
                    setNativeHover(false);
                }
            }}
            onKeyDown={onKeyDown}
            className={ROW_CLASS}
        >
            <span className={ROW_LABEL_CLASS}>{item.label}</span>
            <div {...{ [NAV_SKIP_ATTRIBUTE]: true }}>{control}</div>
        </li>
    );
};

type SettingsMainProps = {
    category: string;
    settings: PauseSettingsData;
};

export const SettingsMain: FunctionComponent<SettingsMainProps> = ({ category, settings }) => {
    const [query, setQuery] = useState('');
    const [hovered, setHovered] = useState<SettingItem | null>(null);
    const [draft, setDraft] = useState<Record<string, number>>({});

    useEffect(() => () => setNativeHover(false), [category, query]);

    useEffect(() => setHovered(null), [category]);

    useEffect(() => {
        setDraft(current => {
            const next = Object.fromEntries(
                Object.entries(current).filter(([key, value]) => settings.native[key] !== value)
            );

            return Object.keys(next).length === Object.keys(current).length ? current : next;
        });
    }, [settings.native]);

    const changeDraft = (key: string, value: number) =>
        setDraft(current => {
            const next = { ...current };

            if (settings.native[key] === value) {
                delete next[key];
            } else {
                next[key] = value;
            }

            return next;
        });

    const pendingChanges = Object.entries(draft).map(([key, value]) => ({ key, value }));

    const current = SETTING_CATEGORIES.find(item => item.id === category) ?? SETTING_CATEGORIES[0];

    const hasWatch = Boolean(settings.server.hasWatch);

    const sections = useMemo<{ category: SettingCategory; items: SettingItem[] }[]>(() => {
        const search = normalize(query.trim());
        const available = (setting: SettingItem) => !setting.requiresWatch || hasWatch;

        if (!search) {
            return [{ category: current, items: current.items.filter(available) }];
        }

        return SETTING_CATEGORIES.map(item => ({
            category: item,
            items: item.items.filter(
                setting =>
                    available(setting) &&
                    (normalize(setting.label).includes(search) || normalize(setting.description).includes(search))
            ),
        })).filter(section => section.items.length > 0);
    }, [query, current, hasWatch]);

    const showNativeButton = !query.trim() && current.native;
    const minimapPage = current.id === 'minimap' && !query.trim();

    usePublishPendingApply(
        'staged',
        pendingChanges.length > 0
            ? {
                  count: pendingChanges.length,
                  label: 'Appliquer les changements',
                  native: true,
                  apply: () => fetchNui(NuiEvent.PauseMenuQueueNative, { changes: pendingChanges }),
                  cancel: () => setDraft({}),
              }
            : null
    );
    const graphicsPage = current.id === 'graphics' && !query.trim();
    const keysPage = current.id === 'keys';
    const voicePage = current.id === 'voice' && !query.trim();

    return (
        <div className="flex h-full min-h-0 gap-[2.4vh] p-[2.4vh]">
            <div className="flex min-h-0 min-w-0 flex-[1.45] flex-col gap-[1.4vh]">
                <label className="flex items-center gap-[1vh] rounded-[1vh] bg-white/10 px-[1.2vh] py-[0.9vh]">
                    <SearchIcon className="h-[1.9vh] w-[1.9vh] shrink-0 text-white/60" />
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            event.stopPropagation();
                            inputNavKeyDown(event);
                        }}
                        placeholder={keysPage ? 'Rechercher une touche…' : 'Rechercher un réglage…'}
                        className="w-full bg-transparent text-[1.5vh] text-white outline-none placeholder:text-white/40"
                    />
                </label>

                {minimapPage && <MinimapPanel />}
                {graphicsPage && <GraphicsPanel />}
                {voicePage && <GraphicsPanel category={current.nativeCategory} />}
                {keysPage && <KeysPanel query={query} />}

                <div
                    className={classNames(
                        'min-h-0 flex-1 overflow-y-auto pr-[0.6vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full',
                        { hidden: graphicsPage || keysPage || voicePage }
                    )}
                >
                    {sections.map(section => (
                        <div key={section.category.id} className="mb-[2vh]">
                            <div className="mb-[0.8vh] flex items-center justify-between">
                                <span className="text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">
                                    {section.category.label}
                                    {section.category.native &&
                                        section.category.items.some(
                                            setting => setting.kind === 'native' && !isNativeSetting(setting.convar)
                                        ) &&
                                        ' · lecture seule'}
                                </span>
                            </div>
                            <ul className="flex flex-col gap-[0.4vh]">
                                {section.items.map(item => (
                                    <SettingRow
                                        key={item.id}
                                        item={item}
                                        settings={settings}
                                        onHover={setHovered}
                                        draft={item.kind === 'native' ? draft[item.convar] : undefined}
                                        onDraft={section.category.staged ? changeDraft : undefined}
                                    />
                                ))}
                            </ul>
                            {section.category.note && !query.trim() && (
                                <p className="mt-[0.8vh] text-[1.4vh] text-white/50">{section.category.note}</p>
                            )}
                        </div>
                    ))}
                    {sections.length === 0 && (
                        <p className="px-[0.8vh] text-[1.4vh] text-white/50">
                            Aucun réglage ne correspond à la recherche.
                        </p>
                    )}
                </div>

                {showNativeButton && (
                    <button
                        onClick={() =>
                            fetchNui(NuiEvent.PauseMenuOpenNative, {
                                page: current.id === 'keys' ? 'keys' : 'settings',
                            })
                        }
                        className="self-start rounded-[1vh] bg-white/10 px-[1.8vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase transition-colors hover:bg-white/25"
                    >
                        Modifier dans GTA
                    </button>
                )}
            </div>

            {!(graphicsPage || keysPage || voicePage || minimapPage) && (
                <DescriptionPanel item={hovered ?? sections[0]?.items[0] ?? null} category={current} />
            )}
        </div>
    );
};

const DescriptionPanel: FunctionComponent<{ item: SettingItem | null; category: SettingCategory }> = ({
    item,
    category,
}) => (
    <aside className="flex min-w-0 flex-1 flex-col gap-[1.4vh] self-start rounded-[1.2vh] bg-white/5 p-[2vh]">
        <div className="flex items-center gap-[1vh] text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">
            <span className="h-[1.6vh] w-[1.6vh] shrink-0">{CATEGORY_ICONS[category.id]}</span>
            {category.label}
        </div>
        {item ? (
            <>
                <div className="text-[1.9vh] font-bold leading-tight">{item.label}</div>
                <p className="text-[1.45vh] leading-relaxed text-white/75">{item.description}</p>
            </>
        ) : (
            <p className="text-[1.45vh] text-white/50">Survole un réglage pour voir sa description.</p>
        )}
    </aside>
);
