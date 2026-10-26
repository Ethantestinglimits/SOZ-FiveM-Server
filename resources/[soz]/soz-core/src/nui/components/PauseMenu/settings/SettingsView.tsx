import { RefreshIcon, SearchIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import { PAUSE_NATIVE_EDITABLE, PauseNativeConvar, PauseSettingsData } from '../../../../shared/nui/pause_settings';
import { fetchNui } from '../../../fetch';
import { SETTING_CATEGORIES, SettingCategory, SettingItem } from './definitions';

const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

type SettingsSidebarProps = {
    category: string;
    onCategoryChange: (category: string) => void;
};

export const SettingsSidebar: FunctionComponent<SettingsSidebarProps> = ({ category, onCategoryChange }) => (
    <div className="flex min-h-0 flex-1 flex-col gap-[1vh]">
        <ul className="min-h-0 flex-1 overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
            {SETTING_CATEGORIES.map(item => (
                <li key={item.id}>
                    <button
                        onClick={() => onCategoryChange(item.id)}
                        className={classNames(
                            'w-full rounded-[0.8vh] px-[1.2vh] py-[0.8vh] text-left text-[1.5vh] font-semibold transition-colors',
                            {
                                'bg-white text-black': category === item.id,
                                'text-white/80 hover:bg-white/15 hover:text-white': category !== item.id,
                            }
                        )}
                    >
                        {item.label}
                    </button>
                </li>
            ))}
        </ul>
        <button
            onClick={() => fetchNui(NuiEvent.PauseMenuResetSettings)}
            className="flex items-center justify-center gap-[0.8vh] rounded-[1vh] bg-red-500/20 px-[1.2vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase text-red-200 transition-colors hover:bg-red-500/60 hover:text-white"
        >
            <RefreshIcon className="h-[1.8vh] w-[1.8vh]" />
            Réinitialiser tout
        </button>
    </div>
);

const NativeSlider: FunctionComponent<{ convar: PauseNativeConvar; min: number; max: number; value: number }> = ({
    convar,
    min,
    max,
    value,
}) => {
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    const commit = () => fetchNui(NuiEvent.PauseMenuSetNativeSetting, { convar, value: local });

    return (
        <div className="flex items-center gap-[1.2vh]">
            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={local}
                onChange={event => setLocal(Number(event.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                className="h-[0.6vh] w-[16vh] cursor-pointer accent-white"
            />
            <span className="w-[3vh] text-right text-[1.4vh] font-semibold tabular-nums">{local}</span>
        </div>
    );
};

type SettingRowProps = {
    item: SettingItem;
    settings: PauseSettingsData;
    onHover: (item: SettingItem | null) => void;
};

const SettingRow: FunctionComponent<SettingRowProps> = ({ item, settings, onHover }) => {
    let control;

    if (item.kind === 'toggle') {
        const value = Boolean(settings.server[item.id] ?? item.default);

        control = (
            <button
                onClick={() => fetchNui(NuiEvent.PauseMenuSetSetting, { key: item.id, value: !value })}
                className={classNames('rounded-[0.8vh] px-[1.4vh] py-[0.4vh] text-[1.4vh] font-semibold transition-colors', {
                    'bg-emerald-500/80 text-white': value,
                    'bg-white/15 text-white/70': !value,
                })}
            >
                {value ? 'Oui' : 'Non'}
            </button>
        );
    } else {
        const raw = settings.native[item.convar];
        const range = PAUSE_NATIVE_EDITABLE[item.convar];
        const label = raw === undefined || raw < 0 ? '—' : item.format(raw);

        if (range && range.max === 1 && raw !== undefined && raw >= 0) {
            control = (
                <button
                    onClick={() =>
                        fetchNui(NuiEvent.PauseMenuSetNativeSetting, { convar: item.convar, value: raw > 0 ? 0 : 1 })
                    }
                    className="rounded-[0.8vh] bg-white/15 px-[1.4vh] py-[0.4vh] text-[1.4vh] font-semibold text-white transition-colors hover:bg-white/30"
                >
                    {label}
                </button>
            );
        } else if (range && raw !== undefined && raw >= 0) {
            control = <NativeSlider convar={item.convar} min={range.min} max={range.max} value={raw} />;
        } else {
            control = (
                <span className="rounded-[0.8vh] bg-white/10 px-[1.4vh] py-[0.4vh] text-[1.4vh] font-semibold text-white/80">
                    {label}
                </span>
            );
        }
    }

    return (
        <li
            onMouseEnter={() => onHover(item)}
            onMouseLeave={() => onHover(null)}
            className="flex items-center justify-between gap-[2vh] rounded-[1vh] bg-white/5 px-[1.6vh] py-[1.1vh] hover:bg-white/10"
        >
            <span className="text-[1.5vh] font-semibold">{item.label}</span>
            {control}
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

    const current = SETTING_CATEGORIES.find(item => item.id === category) ?? SETTING_CATEGORIES[0];

    const sections = useMemo<{ category: SettingCategory; items: SettingItem[] }[]>(() => {
        const search = normalize(query.trim());

        if (!search) {
            return [{ category: current, items: current.items }];
        }

        return SETTING_CATEGORIES.map(item => ({
            category: item,
            items: item.items.filter(
                setting => normalize(setting.label).includes(search) || normalize(setting.description).includes(search)
            ),
        })).filter(section => section.items.length > 0);
    }, [query, current]);

    const showNativeButton = !query.trim() && current.native;

    return (
        <div className="flex h-full min-h-0 flex-col gap-[1.4vh] p-[2.4vh]">
            <label className="flex items-center gap-[1vh] rounded-[1vh] bg-white/10 px-[1.2vh] py-[0.9vh]">
                <SearchIcon className="h-[1.9vh] w-[1.9vh] shrink-0 text-white/60" />
                <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    onKeyDown={event => event.stopPropagation()}
                    placeholder="Rechercher un réglage…"
                    className="w-full bg-transparent text-[1.5vh] text-white outline-none placeholder:text-white/40"
                />
            </label>

            <div className="min-h-0 flex-1 overflow-y-auto pr-[0.6vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                {sections.map(section => (
                    <div key={section.category.id} className="mb-[2vh]">
                        <div className="mb-[0.8vh] flex items-center justify-between">
                            <span className="text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">
                                {section.category.label}
                                {section.category.native && ' · réglages GTA'}
                            </span>
                        </div>
                        <ul className="flex flex-col gap-[0.6vh]">
                            {section.items.map(item => (
                                <SettingRow key={item.id} item={item} settings={settings} onHover={setHovered} />
                            ))}
                        </ul>
                        {section.category.note && !query.trim() && (
                            <p className="mt-[0.8vh] text-[1.4vh] text-white/50">{section.category.note}</p>
                        )}
                    </div>
                ))}
                {sections.length === 0 && (
                    <p className="px-[0.8vh] text-[1.4vh] text-white/50">Aucun réglage ne correspond à la recherche.</p>
                )}
            </div>

            {showNativeButton && (
                <button
                    onClick={() => fetchNui(NuiEvent.PauseMenuOpenNative)}
                    className="self-start rounded-[1vh] bg-white/10 px-[1.8vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase transition-colors hover:bg-white/25"
                >
                    Modifier dans GTA
                </button>
            )}

            <div className="min-h-[7vh] rounded-[1vh] bg-white/5 px-[1.6vh] py-[1.2vh]">
                {hovered ? (
                    <>
                        <div className="text-[1.4vh] font-semibold">{hovered.label}</div>
                        <div className="mt-[0.4vh] text-[1.3vh] text-white/70">{hovered.description}</div>
                    </>
                ) : (
                    <div className="text-[1.3vh] text-white/50">Survole un réglage pour voir sa description.</div>
                )}
            </div>
        </div>
    );
};
