import { HashtagIcon, LocationMarkerIcon, SearchIcon, TagIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useMemo, useRef, useState } from 'react';

import { Postals } from '../../../config/postals';
import { NuiEvent } from '../../../shared/event';
import { PauseMapLayer, PauseMenuData } from '../../../shared/nui/pause_menu';
import { fetchNui } from '../../fetch';
import { getBlipColor, UNTINTED_BLIP_COLORS } from '../Minimap/blipColors';
import { getBlipIconUrl } from '../Minimap/minimapRenderer';
import { minimapController } from '../Minimap/minimapState';

const MAX_RESULTS = 8;

const LAYERS: { id: PauseMapLayer; label: string; icon: ReactNode }[] = [
    { id: 'blips', label: 'Points d’intérêt', icon: <LocationMarkerIcon /> },
    { id: 'regions', label: 'Noms des régions', icon: <TagIcon /> },
    { id: 'postals', label: 'Codes postaux', icon: <HashtagIcon /> },
];

type SearchResult = {
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
};

type LegendGroup = {
    name: string;
    sprite: number;
    color: number;
    points: { x: number; y: number }[];
};

const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

const BlipIcon: FunctionComponent<{ sprite: number; color: number }> = ({ sprite, color }) => {
    const url = getBlipIconUrl(sprite);

    return (
        <span className="relative block h-[2.4vh] w-[2.4vh] shrink-0">
            <img src={url} alt="" className="h-full w-full" />
            {!UNTINTED_BLIP_COLORS.includes(color) && (
                <span
                    className="absolute inset-0"
                    style={{
                        background: getBlipColor(color),
                        mixBlendMode: 'multiply',
                        WebkitMask: `url(${url}) center / contain no-repeat`,
                    }}
                />
            )}
        </span>
    );
};

type MapSidebarProps = {
    data: PauseMenuData;
    layers: PauseMapLayer[];
    onLayersChange: (layers: PauseMapLayer[]) => void;
};

export const MapSidebar: FunctionComponent<MapSidebarProps> = ({ data, layers, onLayersChange }) => {
    const [query, setQuery] = useState('');
    const cycle = useRef(new Map<string, number>());

    const items = useMemo<SearchResult[]>(
        () => [
            ...Postals.map(([code, x, y]) => ({ id: `postal-${code}`, label: code, type: 'Code postal', x, y })),
            ...data.regions.map((region, index) => ({
                id: `region-${index}`,
                label: region.name,
                type: 'Région',
                x: region.x,
                y: region.y,
            })),
            ...data.places.map(place => ({
                id: `place-${place.id}`,
                label: place.name,
                type: 'Lieu',
                x: place.x,
                y: place.y,
            })),
        ],
        [data.regions, data.places]
    );

    const results = useMemo(() => {
        const search = normalize(query.trim());

        if (!search) {
            return [];
        }

        return items.filter(item => normalize(item.label).startsWith(search)).slice(0, MAX_RESULTS);
    }, [items, query]);

    const groups = useMemo<LegendGroup[]>(() => {
        const byName = new Map<string, LegendGroup>();

        for (const place of data.places) {
            const group = byName.get(place.name) ?? {
                name: place.name,
                sprite: place.sprite,
                color: place.color,
                points: [],
            };

            group.points.push({ x: place.x, y: place.y });
            byName.set(place.name, group);
        }

        return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }, [data.places]);

    const select = (result: SearchResult) => {
        setQuery('');
        minimapController.focus?.({ x: result.x, y: result.y });
    };

    const focusNext = (group: LegendGroup) => {
        const index = cycle.current.get(group.name) ?? 0;

        cycle.current.set(group.name, (index + 1) % group.points.length);
        minimapController.focus?.(group.points[index % group.points.length]);
    };

    const toggleLayer = (layer: PauseMapLayer) => {
        const next = layers.includes(layer) ? layers.filter(id => id !== layer) : [...layers, layer];

        onLayersChange(next);
        minimapController.setLayers?.(next);
        fetchNui(NuiEvent.PauseMenuSaveMapLayers, next);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-[1.4vh]">
            <div className="relative">
                <label className="flex items-center gap-[1vh] rounded-[1vh] bg-white/10 px-[1.2vh] py-[0.9vh]">
                    <SearchIcon className="h-[1.9vh] w-[1.9vh] shrink-0 text-white/60" />
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            event.stopPropagation();

                            if (event.key === 'Enter' && results.length > 0) {
                                select(results[0]);
                            }
                        }}
                        placeholder="Code postal, région, lieu…"
                        className="w-full bg-transparent text-[1.5vh] text-white outline-none placeholder:text-white/40"
                    />
                </label>
                {results.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-20 mt-[0.6vh] overflow-hidden rounded-[1vh] border border-white/20 bg-black/85">
                        {results.map(result => (
                            <li key={result.id}>
                                <button
                                    onClick={() => select(result)}
                                    className="flex w-full items-center justify-between px-[1.2vh] py-[0.8vh] text-left text-[1.4vh] hover:bg-white/15"
                                >
                                    <span className="truncate">{result.label}</span>
                                    <span className="ml-[1vh] shrink-0 text-[1.1vh] uppercase tracking-wider text-white/40">
                                        {result.type}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex gap-[0.6vh]">
                {LAYERS.map(layer => (
                    <button
                        key={layer.id}
                        onClick={() => toggleLayer(layer.id)}
                        title={layer.label}
                        className={classNames(
                            'flex flex-1 items-center justify-center rounded-[0.9vh] py-[0.8vh] transition-colors duration-150',
                            {
                                'bg-white text-black': layers.includes(layer.id),
                                'bg-white/10 text-white/70 hover:bg-white/25 hover:text-white': !layers.includes(layer.id),
                            }
                        )}
                    >
                        <span className="h-[2vh] w-[2vh]">{layer.icon}</span>
                    </button>
                ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-[0.8vh]">
                <div className="text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">
                    Points d’intérêt
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                    {groups.map(group => (
                        <li key={group.name}>
                            <button
                                onClick={() => focusNext(group)}
                                className="flex w-full items-center gap-[1vh] rounded-[0.8vh] px-[0.8vh] py-[0.5vh] text-left transition-colors hover:bg-white/15"
                            >
                                <BlipIcon sprite={group.sprite} color={group.color} />
                                <span className="truncate text-[1.45vh]">{group.name}</span>
                                {group.points.length > 1 && (
                                    <span className="ml-auto shrink-0 text-[1.2vh] tabular-nums text-white/50">
                                        {group.points.length}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                    {groups.length === 0 && <li className="px-[0.8vh] text-[1.4vh] text-white/50">Aucun point.</li>}
                </ul>
            </div>
        </div>
    );
};
