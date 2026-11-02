import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import { PauseGraphicsRow } from '../../../../shared/nui/pause_menu';
import { fetchNui } from '../../../fetch';
import { useNuiEvent } from '../../../hook/nui';

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

const optionsOf = (row: PauseGraphicsRow) => (row.options.length > 1 ? row.options : OPTIONS[row.id] ?? row.options);

const indexOf = (row: PauseGraphicsRow) =>
    row.options.length > 1 ? row.value : Math.max(0, optionsOf(row).indexOf(row.options[0]));

export const GraphicsPanel: FunctionComponent = () => {
    const [rows, setRows] = useState<PauseGraphicsRow[] | null>(null);
    const [values, setValues] = useState<Record<number, number>>({});
    const [applying, setApplying] = useState(false);
    const applied = useRef(false);
    const [confirmRestart, setConfirmRestart] = useState(false);

    useEffect(() => {
        fetchNui(NuiEvent.PauseMenuGraphicsOpen);

        return () => {
            fetchNui(NuiEvent.PauseMenuGraphicsClose);
        };
    }, []);

    useNuiEvent('pause_menu', 'GraphicsRows', (next) => {
        setRows(next);

        if (applied.current) {
            applied.current = false;
            setValues({});
            setApplying(false);
        }
    });

    const visible = useMemo(
        () => (rows ?? []).filter((row) => row.type === ROW_TYPE_LIST || row.type === ROW_TYPE_SLIDER),
        [rows],
    );

    const changes = Object.keys(values).length;

    const setValue = (row: PauseGraphicsRow, next: number) => {
        const base = row.type === ROW_TYPE_SLIDER ? row.value : indexOf(row);

        if (next === (values[row.id] ?? base)) {
            return;
        }

        fetchNui(NuiEvent.PauseMenuGraphicsSet, { id: row.id, value: next });
        setValues((state) => {
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
        const cycle = CYCLE_ROWS.includes(row.id);
        const count = optionsOf(row).length;
        const current = values[row.id] ?? (row.type === ROW_TYPE_SLIDER ? row.value : indexOf(row));
        const next =
            row.type === ROW_TYPE_SLIDER
                ? Math.min(row.max, Math.max(0, current + direction))
                : (current + direction + count) % count;

        if (cycle) {
            fetchNui(NuiEvent.PauseMenuGraphicsStep, { index: row.slot, id: row.id, direction });

            return;
        }

        setValue(row, next);
    };

    const apply = () => {
        setConfirmRestart(false);
        applied.current = true;
        setApplying(true);
        fetchNui(NuiEvent.PauseMenuGraphicsApply);
    };

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
                <ul className="flex flex-col gap-[0.6vh]">
                    {visible.map((row) => {
                        const locked = !row.selectable;
                        const changed = values[row.id] !== undefined;

                        return (
                            <li
                                key={row.id}
                                className="flex items-center justify-between gap-[2vh] rounded-[1vh] bg-white/5 px-[1.6vh] py-[0.9vh]"
                            >
                                <span className="text-[1.5vh] font-semibold">
                                    {row.label}
                                    {RESTART_ROWS.includes(row.id) && (
                                        <span className="ml-[1vh] text-[1.2vh] font-normal text-white/50">
                                            redémarrage requis
                                        </span>
                                    )}
                                </span>
                                <div className="flex items-center gap-[0.8vh]">
                                    {!locked && (
                                        <button
                                            onClick={() => step(row, -1)}
                                            className="h-[2.6vh] w-[2.6vh] rounded-[0.6vh] bg-white/15 text-[1.4vh] font-bold hover:bg-white/30"
                                        >
                                            ‹
                                        </button>
                                    )}
                                    {row.type === ROW_TYPE_SLIDER && (
                                        <input
                                            type="range"
                                            min={0}
                                            max={row.max}
                                            step={1}
                                            disabled={locked}
                                            value={values[row.id] ?? row.value}
                                            onChange={(event) => setValue(row, Number(event.target.value))}
                                            className="h-[0.6vh] w-[16vh] cursor-pointer accent-white"
                                        />
                                    )}
                                    <span
                                        className={`text-center text-[1.4vh] font-semibold tabular-nums ${
                                            row.type === ROW_TYPE_SLIDER ? 'min-w-[3vh]' : 'min-w-[12vh]'
                                        } ${changed ? 'text-amber-300' : locked ? 'text-white/50' : ''}`}
                                    >
                                        {textOf(row)}
                                    </span>
                                    {!locked && (
                                        <button
                                            onClick={() => step(row, 1)}
                                            className="h-[2.6vh] w-[2.6vh] rounded-[0.6vh] bg-white/15 text-[1.4vh] font-bold hover:bg-white/30"
                                        >
                                            ›
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

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

            <div className="flex items-center gap-[1.6vh]">
                <button
                    disabled={changes === 0 || applying}
                    onClick={() => {
                        if (Object.keys(values).some((id) => RESTART_ROWS.includes(Number(id)))) {
                            setConfirmRestart(true);

                            return;
                        }

                        apply();
                    }}
                    className="rounded-[1vh] bg-white px-[1.8vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase text-black transition-colors hover:bg-white/80 disabled:cursor-default disabled:bg-white/10 disabled:text-white/40 disabled:hover:bg-white/10"
                >
                    {applying ? 'Application…' : `Appliquer les changements${changes > 0 ? ` (${changes})` : ''}`}
                </button>
            </div>
        </div>
    );
};
