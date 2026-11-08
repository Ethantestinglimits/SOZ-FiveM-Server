import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import { PauseGraphicsRow } from '../../../../shared/nui/pause_menu';
import { fetchNui } from '../../../fetch';
import { useNuiEvent } from '../../../hook/nui';
import { setNativeBackdrop } from './nativeInputState';
import { usePublishPendingApply } from './pendingApply';
import { Arrow, ROW_CLASS, ROW_LABEL_CLASS, ValueStepper } from './rowControls';

const ROW_TYPE_LIST = 1;
const ROW_TYPE_SLIDER = 2;
const RESTART_ROWS = [67, 68, 69, 74, 75];
const CYCLE_ROWS = [60, 81];
const QUALITY = ['Normale', 'Élevée', 'Très élevée', 'Ultra'];
const MSAA = ['Sans', 'X2', 'X4', 'X8'];
const OPTIONS: Record<number, string[]> = {
    67: ['DirectX 10', 'DirectX 10.1', 'DirectX 11'],
    72: MSAA,
    75: QUALITY,
    76: ['Basse', 'Moyenne', 'Élevée', 'Très élevée', 'AMD CHS', 'NVIDIA PCSS'],
    80: MSAA,
    82: ['Sans', 'Avec'],
    85: ['Sans', 'Normale', 'Élevée', 'Très élevée'],
    86: QUALITY,
    87: ['Sans', 'Avec'],
};

const GRAPHICS_CATEGORY = 6;

export const GraphicsPanel: FunctionComponent<{ category?: number }> = ({ category = GRAPHICS_CATEGORY }) => {
    const graphics = category === GRAPHICS_CATEGORY;
    const restartRows = graphics ? RESTART_ROWS : [];
    const optionsOf = (row: PauseGraphicsRow) =>
        row.options.length > 1 ? row.options : (graphics && OPTIONS[row.id]) || row.options;
    const isCycle = (row: PauseGraphicsRow) =>
        graphics ? CYCLE_ROWS.includes(row.id) : row.type === ROW_TYPE_LIST && row.options.length <= 1;
    const indexOf = (row: PauseGraphicsRow) =>
        row.options.length > 1 ? row.value : Math.max(0, optionsOf(row).indexOf(row.options[0]));

    return (
        <GraphicsRowsPanel
            category={category}
            restartRows={restartRows}
            optionsOf={optionsOf}
            isCycle={isCycle}
            indexOf={indexOf}
        />
    );
};

type GraphicsRowsPanelProps = {
    category: number;
    restartRows: number[];
    optionsOf: (row: PauseGraphicsRow) => string[];
    isCycle: (row: PauseGraphicsRow) => boolean;
    indexOf: (row: PauseGraphicsRow) => number;
};

const GraphicsRowsPanel: FunctionComponent<GraphicsRowsPanelProps> = ({
    category,
    restartRows,
    optionsOf,
    isCycle,
    indexOf,
}) => {
    const [rows, setRows] = useState<PauseGraphicsRow[] | null>(null);
    const [values, setValues] = useState<Record<number, number>>({});
    const [stepped, setStepped] = useState<Record<number, number>>({});
    const [applying, setApplying] = useState(false);
    const applied = useRef(false);
    const [confirmRestart, setConfirmRestart] = useState(false);

    useEffect(() => {
        fetchNui(NuiEvent.PauseMenuGraphicsOpen, { category });

        return () => {
            setNativeBackdrop(false);
            fetchNui(NuiEvent.PauseMenuGraphicsClose);
        };
    }, []);

    useNuiEvent('pause_menu', 'GraphicsNative', setNativeBackdrop);

    useNuiEvent('pause_menu', 'GraphicsRows', next => {
        setRows(next);

        if (applied.current) {
            applied.current = false;
            setValues({});
            setStepped({});
            setApplying(false);
        }
    });

    const visible = useMemo(
        () => (rows ?? []).filter(row => row.type === ROW_TYPE_LIST || row.type === ROW_TYPE_SLIDER),
        [rows]
    );

    const changes = Object.keys(values).length + Object.keys(stepped).length;
    const restartChanges = visible.filter(row => restartRows.includes(row.id) && values[row.id] !== undefined);

    const setValue = (row: PauseGraphicsRow, next: number) => {
        const base = row.type === ROW_TYPE_SLIDER ? row.value : indexOf(row);

        if (next === (values[row.id] ?? base)) {
            return;
        }

        setValues(state => {
            const updated = { ...state };

            if (next === base) {
                delete updated[row.id];
            } else {
                updated[row.id] = next;
            }

            return updated;
        });
    };

    const step = (row: PauseGraphicsRow, direction: number) => {
        const cycle = isCycle(row);
        const count = optionsOf(row).length;
        const current = values[row.id] ?? (row.type === ROW_TYPE_SLIDER ? row.value : indexOf(row));
        const next =
            row.type === ROW_TYPE_SLIDER
                ? Math.min(row.max, Math.max(0, current + direction))
                : (current + direction + count) % count;

        if (cycle) {
            fetchNui(NuiEvent.PauseMenuGraphicsStep, { id: row.id, direction });
            setStepped(state => {
                const updated = { ...state };
                const total = (state[row.id] ?? 0) + direction;

                if (total === 0) {
                    delete updated[row.id];
                } else {
                    updated[row.id] = total;
                }

                return updated;
            });

            return;
        }

        setValue(row, next);
    };

    const apply = () => {
        setConfirmRestart(false);
        applied.current = true;
        setApplying(true);
        fetchNui(NuiEvent.PauseMenuGraphicsApply, { values });
    };

    usePublishPendingApply(
        'graphics',
        changes > 0 || applying
            ? {
                  count: changes,
                  busy: applying,
                  label: restartChanges.length > 0 ? 'Appliquer et redémarrer' : 'Appliquer les changements',
                  apply: () => (restartChanges.length > 0 ? setConfirmRestart(true) : apply()),
              }
            : null
    );

    const percentOf = (row: PauseGraphicsRow) => ((values[row.id] ?? row.value) / Math.max(1, row.max)) * 100;

    const textOf = (row: PauseGraphicsRow) => {
        if (row.type === ROW_TYPE_SLIDER) {
            return String(values[row.id] ?? row.value);
        }

        return optionsOf(row)[values[row.id] ?? indexOf(row)] ?? '—';
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-[1vh]">
            <div className="min-h-0 flex-1 overflow-y-auto pr-[0.6vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                {rows === null && <p className="text-[1.4vh] text-white/50">Lecture des réglages du jeu…</p>}
                {rows?.length === 0 && (
                    <div className="flex flex-col items-start gap-[1vh]">
                        <p className="text-[1.4vh] text-white/50">
                            Les réglages graphiques ne sont pas disponibles ici.
                        </p>
                        <button
                            onClick={() => fetchNui(NuiEvent.PauseMenuOpenNative, { page: 'settings' })}
                            className="rounded-[1vh] bg-white/10 px-[1.8vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase transition-colors hover:bg-white/25"
                        >
                            Modifier dans GTA
                        </button>
                    </div>
                )}
                <ul className="flex flex-col gap-[0.4vh]">
                    {visible.map(row => {
                        const locked = !row.selectable;
                        const changed = values[row.id] !== undefined || stepped[row.id] !== undefined;

                        return (
                            <li key={row.id} className={ROW_CLASS}>
                                <span className={ROW_LABEL_CLASS}>
                                    {row.label}
                                    {restartRows.includes(row.id) && (
                                        <span
                                            className={`ml-[1vh] text-[1.15vh] font-normal ${
                                                changed ? 'text-amber-300' : 'text-white/50'
                                            }`}
                                        >
                                            redémarrage requis
                                        </span>
                                    )}
                                </span>
                                {row.type === ROW_TYPE_SLIDER ? (
                                    <div className="flex items-center gap-[1vh]">
                                        {locked ? (
                                            <span className="w-[2.6vh]" />
                                        ) : (
                                            <Arrow direction={-1} onPress={() => step(row, -1)} />
                                        )}
                                        <input
                                            type="range"
                                            tabIndex={-1}
                                            min={0}
                                            max={row.max}
                                            step={1}
                                            disabled={locked}
                                            value={values[row.id] ?? row.value}
                                            onChange={event => setValue(row, Number(event.target.value))}
                                            className="soz-volume-slider w-[16vh]"
                                            style={{
                                                background: `linear-gradient(to right, #fff ${percentOf(row)}%, rgba(255, 255, 255, 0.2) ${percentOf(row)}%)`,
                                            }}
                                        />
                                        <span
                                            className={`min-w-[4.6vh] text-right text-[1.25vh] font-semibold tabular-nums ${
                                                changed ? 'text-amber-300' : locked ? 'text-white/50' : ''
                                            }`}
                                        >
                                            {textOf(row)}
                                        </span>
                                        {locked ? (
                                            <span className="w-[2.6vh]" />
                                        ) : (
                                            <Arrow direction={1} onPress={() => step(row, 1)} />
                                        )}
                                    </div>
                                ) : (
                                    <ValueStepper
                                        label={textOf(row)}
                                        index={values[row.id] ?? indexOf(row)}
                                        count={isCycle(row) ? 0 : optionsOf(row).length}
                                        changed={changed}
                                        disabled={locked}
                                        onChange={direction => step(row, direction)}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            {restartChanges.length > 0 && !confirmRestart && (
                <p className="rounded-[1vh] bg-amber-500/15 px-[1.6vh] py-[1vh] text-[1.4vh]">
                    GTA V devra redémarrer pour appliquer : {restartChanges.map(row => row.label).join(', ')}.
                </p>
            )}

            {confirmRestart && (
                <div className="flex items-center justify-between gap-[2vh] rounded-[1vh] bg-amber-500/15 px-[1.6vh] py-[1vh]">
                    <span className="text-[1.4vh]">
                        Pour appliquer ces modifications, GTA V doit redémarrer. Toute progression non sauvegardée sera
                        perdue.
                    </span>
                    <div className="flex shrink-0 gap-[0.8vh]">
                        <button
                            onClick={apply}
                            className="rounded-[1vh] bg-white px-[1.6vh] py-[0.7vh] text-[1.4vh] font-semibold text-black hover:bg-white/80"
                        >
                            Redémarrer
                        </button>
                        <button
                            onClick={() => setConfirmRestart(false)}
                            className="rounded-[1vh] bg-white/15 px-[1.6vh] py-[0.7vh] text-[1.4vh] font-semibold hover:bg-white/30"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
