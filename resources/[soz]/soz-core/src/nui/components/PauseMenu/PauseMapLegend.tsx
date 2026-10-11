import { FunctionComponent, useMemo, useRef } from 'react';

import { PauseMapBlip, PauseMapPoint } from '../../../shared/nui/pause_menu';
import { getBlipColor, UNTINTED_BLIP_COLORS } from './blipColors';
import { getBlipIconUrl } from './pauseMapRenderer';

type LegendGroup = {
    name: string;
    sprite: number;
    color: number;
    points: PauseMapPoint[];
};

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

type PauseMapLegendProps = {
    blips: PauseMapBlip[];
    onFocus: (point: PauseMapPoint) => void;
};

export const PauseMapLegend: FunctionComponent<PauseMapLegendProps> = ({ blips, onFocus }) => {
    const cycle = useRef(new Map<string, number>());

    const groups = useMemo<LegendGroup[]>(() => {
        const byName = new Map<string, LegendGroup>();

        for (const blip of blips) {
            if (!blip.name) {
                continue;
            }

            const group = byName.get(blip.name) ?? {
                name: blip.name,
                sprite: blip.sprite,
                color: blip.color,
                points: [],
            };

            group.points.push({ x: blip.x, y: blip.y });
            byName.set(blip.name, group);
        }

        return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }, [blips]);

    const focusNext = (group: LegendGroup) => {
        const index = cycle.current.get(group.name) ?? 0;

        cycle.current.set(group.name, (index + 1) % group.points.length);
        onFocus(group.points[index % group.points.length]);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-[0.8vh]">
            <div className="text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">Points d’intérêt</div>
            <ul className="min-h-0 flex-1 overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                {groups.map((group) => (
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
    );
};
