import { PencilIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import { PauseKeyBinding, PauseKeyCapture, PauseKeyCategory } from '../../../../shared/nui/pause_menu';
import { fetchNui } from '../../../fetch';
import { useNuiEvent } from '../../../hook/nui';
import { keyGlyph } from './KeyGlyph';
import { setKeyCapture, setNativeBackdrop } from './nativeInputState';

const KEY_NAMES: Record<string, string> = {
    b_100: 'Clic G',
    b_101: 'Clic D',
    b_102: 'Clic M',
    b_103: 'Souris 4',
    b_104: 'Souris 5',
    b_115: 'Molette ↑',
    b_116: 'Molette ↓',
    b_136: 'Pavé 0',
    b_137: 'Pavé 1',
    b_138: 'Pavé 2',
    b_139: 'Pavé 3',
    b_140: 'Pavé 4',
    b_141: 'Pavé 5',
    b_142: 'Pavé 6',
    b_143: 'Pavé 7',
    b_144: 'Pavé 8',
    b_145: 'Pavé 9',
    b_170: 'F1',
    b_171: 'F2',
    b_172: 'F3',
    b_173: 'F4',
    b_174: 'F5',
    b_175: 'F6',
    b_176: 'F7',
    b_177: 'F8',
    b_178: 'F9',
    b_179: 'F10',
    b_180: 'F11',
    b_181: 'F12',
    b_182: 'F13',
    b_183: 'F14',
    b_184: 'F15',
    b_185: 'F16',
    b_186: 'F17',
    b_187: 'F18',
    b_188: 'F19',
    b_189: 'F20',
    b_190: 'F21',
    b_191: 'F22',
    b_192: 'F23',
    b_193: 'F24',
    b_194: '↑',
    b_195: '↓',
    b_196: '←',
    b_197: '→',
    b_200: 'Inser',
    b_202: 'Suppr',
    b_203: 'Échap',
    b_1002: 'Tab',
    b_1003: 'Entrée',
    b_1004: 'Retour',
    b_1022: 'Début',
    b_1024: 'Page ↓',
    b_1026: 'Verr. Maj',
    b_1027: 'Ctrl',
    b_1072: 'Maj',
    b_1074: 'Alt',
    b_2000: 'Espace',
};

const GAMEPAD_BUTTON_LIMIT = 100;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const keyLabel = (key?: string) => {
    if (!key || key === 'b_-1') {
        return '—';
    }

    if (KEY_NAMES[key]) {
        return KEY_NAMES[key];
    }

    return key.startsWith('b_') && Number(key.slice(2)) < GAMEPAD_BUTTON_LIMIT ? 'Manette' : key;
};

const Keycap: FunctionComponent<{ value?: string }> = ({ value }) => {
    const glyph = keyGlyph(value);

    if (glyph) {
        return (
            <span title={keyLabel(value)} className="flex h-[2.6vh] items-center">
                {glyph}
            </span>
        );
    }

    return (
        <span
            className={classNames(
                'flex h-[2.6vh] min-w-[2.6vh] items-center justify-center rounded-[0.5vh] px-[0.6vh] text-[1.2vh] font-bold uppercase',
                value ? 'bg-white text-black shadow-[inset_0_-0.25vh_0_rgba(0,0,0,0.25)]' : 'text-white/40',
            )}
        >
            {keyLabel(value)}
        </span>
    );
};

const CAPTURE_SECONDS = 10;

const CaptureCountdown: FunctionComponent = () => {
    const [left, setLeft] = useState(CAPTURE_SECONDS);

    useEffect(() => {
        const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);

        return () => clearInterval(timer);
    }, []);

    return <span className="text-white/50">(Échap pour annuler, sinon dans {left} s)</span>;
};

type KeyGroup = 'soz' | 'game';

const KEY_GROUPS: { id: KeyGroup; label: string }[] = [
    { id: 'soz', label: 'SoZ' },
    { id: 'game', label: 'Jeu' },
];

const groupOf = (category: PauseKeyCategory): KeyGroup => (category.index === -1 ? 'soz' : 'game');

type Row = PauseKeyBinding & { category: string; categoryIndex: number; categoryId: number };

export const KeysPanel: FunctionComponent<{ query: string }> = ({ query }) => {
    const [data, setData] = useState<{ categories: PauseKeyCategory[]; loading: boolean } | null>(null);
    const [group, setGroup] = useState<KeyGroup>('soz');
    const [selected, setSelected] = useState<Record<KeyGroup, number | null>>({ soz: null, game: null });
    const [capture, setCapture] = useState<{ state: PauseKeyCapture; slot?: number; category?: number }>({
        state: 'idle',
    });
    const [confirmReset, setConfirmReset] = useState(false);

    useEffect(() => {
        fetchNui(NuiEvent.PauseMenuKeysOpen);

        return () => {
            setNativeBackdrop(false);
            setKeyCapture('idle');
            fetchNui(NuiEvent.PauseMenuKeysClose);
        };
    }, []);

    useNuiEvent('pause_menu', 'GraphicsNative', setNativeBackdrop);
    useNuiEvent('pause_menu', 'KeyCategories', setData);
    useNuiEvent('pause_menu', 'KeyCapture', (next) => {
        setCapture(next);
        setKeyCapture(next.state);
    });

    const busy = capture.state !== 'idle';

    const startCapture = (row: Row) => {
        if (busy) {
            return;
        }

        const native = row.native ?? { index: row.categoryIndex, id: row.categoryId };

        setCapture({ state: 'waiting', category: native.id, slot: row.slot });
        setKeyCapture('waiting');
        fetchNui(NuiEvent.PauseMenuKeysCapture, { index: native.index, id: native.id, slot: row.slot });
    };

    const reset = () => {
        setConfirmReset(false);
        setCapture({ state: 'waiting' });
        setKeyCapture('waiting');
        fetchNui(NuiEvent.PauseMenuKeysReset);
    };

    const categories = data?.categories ?? [];
    const search = normalize(query.trim());
    const visible = categories.filter((category) => groupOf(category) === group);
    const current = visible.find((category) => category.id === selected[group]) ?? visible[0];

    const rows = useMemo<Row[]>(() => {
        if (!search) {
            return (current?.rows ?? []).map((row) => ({
                ...row,
                category: current.label,
                categoryIndex: current.index,
                categoryId: current.id,
            }));
        }

        return categories.flatMap((category) =>
            category.rows
                .filter(
                    (row) =>
                        normalize(row.label).includes(search) ||
                        normalize(keyLabel(row.key)) === search ||
                        normalize(row.resource ?? '').includes(search),
                )
                .map((row) => ({
                    ...row,
                    category: category.label,
                    categoryIndex: category.index,
                    categoryId: category.id,
                })),
        );
    }, [categories, current, search]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-[1.2vh]">
            {!search && (
                <div className="flex w-fit gap-[0.4vh] rounded-[1vh] bg-white/10 p-[0.4vh]">
                    {KEY_GROUPS.map((entry) => (
                        <button
                            key={entry.id}
                            onClick={() => setGroup(entry.id)}
                            className={classNames(
                                'rounded-[0.7vh] px-[1.8vh] py-[0.5vh] text-[1.35vh] font-semibold uppercase tracking-wider transition-colors',
                                group === entry.id
                                    ? 'bg-white text-black'
                                    : 'text-white/70 hover:bg-white/20 hover:text-white',
                            )}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>
            )}

            {!search && (
                <div className="flex flex-wrap gap-[0.6vh]">
                    {visible.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setSelected((state) => ({ ...state, [group]: category.id }))}
                            className={classNames(
                                'rounded-[0.7vh] px-[1.1vh] py-[0.5vh] text-[1.25vh] font-semibold transition-colors',
                                category === current
                                    ? 'bg-white text-black'
                                    : 'bg-white/10 text-white/80 hover:bg-white/25 hover:text-white',
                            )}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>
            )}

            {categories.length > 0 && !search && (
                <div className="flex items-center gap-[1vh]">
                    {confirmReset ? (
                        <>
                            <span className="flex-1 text-[1.35vh] text-white/80">
                                Toutes les touches reviendront à leurs valeurs par défaut.
                            </span>
                            <button
                                onClick={reset}
                                className="rounded-[0.8vh] bg-white px-[1.4vh] py-[0.6vh] text-[1.3vh] font-semibold text-black hover:bg-white/80"
                            >
                                Rétablir
                            </button>
                            <button
                                onClick={() => setConfirmReset(false)}
                                className="rounded-[0.8vh] bg-white/15 px-[1.4vh] py-[0.6vh] text-[1.3vh] font-semibold hover:bg-white/30"
                            >
                                Annuler
                            </button>
                        </>
                    ) : (
                        <button
                            disabled={busy}
                            onClick={() => setConfirmReset(true)}
                            className="w-full rounded-[0.8vh] bg-white/10 py-[0.7vh] text-[1.3vh] font-semibold transition-colors hover:bg-white/25 disabled:opacity-40"
                        >
                            Rétablir les touches par défaut
                        </button>
                    )}
                </div>
            )}

            <ul className="flex min-h-0 flex-1 flex-col gap-[0.5vh] overflow-y-auto pr-[0.6vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                {data === null && <li className="text-[1.4vh] text-white/50">Lecture des touches du jeu…</li>}
                {data?.loading && categories.length === 0 && (
                    <li className="text-[1.4vh] text-white/50">Lecture des touches du jeu…</li>
                )}
                {data && !data.loading && categories.length === 0 && (
                    <li className="text-[1.4vh] text-white/50">Les touches ne sont pas disponibles ici.</li>
                )}
                {search && data && rows.length === 0 && (
                    <li className="text-[1.4vh] text-white/50">Aucune touche ne correspond.</li>
                )}
                {rows.map((row) => {
                    const capturing =
                        capture.state !== 'idle' &&
                        capture.category === (row.native?.id ?? row.categoryId) &&
                        capture.slot === row.slot;

                    return (
                        <li
                            key={`${row.category}-${row.slot}`}
                            className="flex items-center justify-between gap-[2vh] rounded-[1vh] bg-white/5 px-[1.6vh] py-[0.8vh]"
                        >
                            <span className="min-w-0 truncate text-[1.45vh] font-semibold">
                                {row.label || '(sans nom)'}
                                {search && (
                                    <span className="ml-[1vh] text-[1.15vh] font-normal text-white/40">
                                        {row.category}
                                    </span>
                                )}
                                {row.resource && (
                                    <span className="ml-[1vh] text-[1.15vh] font-normal text-white/40">
                                        {row.resource}
                                    </span>
                                )}
                            </span>
                            {capturing ? (
                                <span className="shrink-0 text-[1.3vh] text-amber-300">
                                    Appuie sur une touche… <CaptureCountdown />
                                </span>
                            ) : (
                                <button
                                    disabled={busy}
                                    onClick={() => startCapture(row)}
                                    className="flex shrink-0 items-center gap-[0.8vh] rounded-[0.6vh] px-[0.4vh] py-[0.2vh] text-white/40 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-40"
                                >
                                    <PencilIcon className="h-[1.6vh] w-[1.6vh]" />
                                    <Keycap value={row.key} />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
