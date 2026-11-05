import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, KeyboardEvent, useMemo, useState } from 'react';

import { MinimapBlip, MinimapPlayerGroup, PlayersLayerLayout } from '../../../shared/nui/minimap';
import { getBlipColor } from '../Minimap/blipColors';
import { minimapController } from '../Minimap/minimapState';
import { NAV_SKIP_ATTRIBUTE } from './keyboardNav';

const FALLBACK_GROUP: MinimapPlayerGroup = { id: 'civil', label: 'Civil', order: 30 };

type PlayerGroup = MinimapPlayerGroup & { color: number; players: MinimapBlip[] };

type PlayerGroupsListProps = {
    players: MinimapBlip[];
    layout: PlayersLayerLayout;
    onLayoutChange: (layout: PlayersLayerLayout) => void;
};

const focusPlayer = (player: MinimapBlip) => {
    const live = minimapController.renderer?.blips.find((blip) => blip.id === player.id) ?? player;

    minimapController.focus?.({ x: live.x, y: live.y }, player.name);
};

export const PlayerGroupsList: FunctionComponent<PlayerGroupsListProps> = ({ players, layout, onLayoutChange }) => {
    const [cycle, setCycle] = useState<Record<string, number>>({});

    const groups = useMemo<PlayerGroup[]>(() => {
        const byId = new Map<string, PlayerGroup>();

        for (const player of players) {
            const group = player.group ?? FALLBACK_GROUP;
            const entry = byId.get(group.id) ?? { ...group, color: player.color, players: [] };

            entry.players.push(player);
            byId.set(group.id, entry);
        }

        return [...byId.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'fr'));
    }, [players]);

    const indexOf = (group: PlayerGroup) => Math.min(cycle[group.id] ?? 0, group.players.length - 1);

    const step = (group: PlayerGroup, direction: number) => {
        const count = group.players.length;
        const current = cycle[group.id] === undefined ? (direction > 0 ? -1 : 0) : indexOf(group);
        const next = (((current + direction) % count) + count) % count;

        setCycle((state) => ({ ...state, [group.id]: next }));
        focusPlayer(group.players[next]);
    };

    const toggleExpanded = (id: string) =>
        onLayoutChange({
            ...layout,
            expanded: layout.expanded.includes(id)
                ? layout.expanded.filter((entry) => entry !== id)
                : [...layout.expanded, id],
        });

    const onRowKeyDown = (group: PlayerGroup) => (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            step(group, event.key === 'ArrowRight' ? 1 : -1);
        }
    };

    return (
        <div className={classNames('flex min-h-0 flex-col gap-[0.8vh]', { 'max-h-[40%]': !layout.collapsed })}>
            <button
                onClick={() => onLayoutChange({ ...layout, collapsed: !layout.collapsed })}
                className="flex items-center gap-[0.6vh] text-left text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white"
            >
                <ChevronRightIcon
                    className={classNames('h-[1.6vh] w-[1.6vh] transition-transform', {
                        'rotate-90': !layout.collapsed,
                    })}
                />
                Joueurs ({players.length})
            </button>
            {!layout.collapsed && (
                <ul className="min-h-0 flex-1 overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                    {groups.map((group) => {
                        const index = indexOf(group);
                        const expanded = layout.expanded.includes(group.id);

                        return (
                            <li key={group.id} className="flex flex-col">
                                <div
                                    onKeyDown={onRowKeyDown(group)}
                                    className="flex items-center rounded-[0.8vh] transition-colors hover:bg-white/15"
                                >
                                    <button
                                        onClick={() => toggleExpanded(group.id)}
                                        className="flex h-[2.4vh] w-[2.4vh] shrink-0 items-center justify-center rounded-[0.6vh] hover:bg-white/25"
                                    >
                                        <ChevronRightIcon
                                            className={classNames('h-[1.5vh] w-[1.5vh] transition-transform', {
                                                'rotate-90': expanded,
                                            })}
                                        />
                                    </button>
                                    <button
                                        onClick={() => step(group, 1)}
                                        className="flex min-w-0 flex-1 items-center gap-[0.8vh] px-[0.6vh] py-[0.5vh] text-left"
                                    >
                                        <span
                                            className="h-[1.2vh] w-[1.2vh] shrink-0 rounded-full"
                                            style={{ background: getBlipColor(group.color) }}
                                        />
                                        <span className="shrink-0 text-[1.45vh] font-semibold">{group.label}</span>
                                        <span className="min-w-0 truncate text-[1.35vh] text-white/70">
                                            {group.players[index].name}
                                        </span>
                                        <span className="ml-auto shrink-0 text-[1.2vh] tabular-nums text-white/50">
                                            {index + 1}/{group.players.length}
                                        </span>
                                    </button>
                                    <div className="mr-[0.4vh] flex shrink-0 gap-[0.2vh]">
                                        <button
                                            {...{ [NAV_SKIP_ATTRIBUTE]: true }}
                                            onClick={() => step(group, -1)}
                                            className="flex h-[2.4vh] w-[2.4vh] items-center justify-center rounded-[0.6vh] hover:bg-white/25"
                                        >
                                            <ChevronLeftIcon className="h-[1.6vh] w-[1.6vh]" />
                                        </button>
                                        <button
                                            {...{ [NAV_SKIP_ATTRIBUTE]: true }}
                                            onClick={() => step(group, 1)}
                                            className="flex h-[2.4vh] w-[2.4vh] items-center justify-center rounded-[0.6vh] hover:bg-white/25"
                                        >
                                            <ChevronRightIcon className="h-[1.6vh] w-[1.6vh]" />
                                        </button>
                                    </div>
                                </div>
                                {expanded && (
                                    <ul className="ml-[2.8vh] flex flex-col">
                                        {group.players.map((player) => (
                                            <li key={player.id}>
                                                <button
                                                    onClick={() => focusPlayer(player)}
                                                    className="w-full truncate rounded-[0.6vh] px-[0.8vh] py-[0.3vh] text-left text-[1.35vh] text-white/80 hover:bg-white/15 hover:text-white"
                                                >
                                                    {player.name}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
