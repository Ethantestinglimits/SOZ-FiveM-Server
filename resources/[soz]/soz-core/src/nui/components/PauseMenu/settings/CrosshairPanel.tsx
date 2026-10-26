import { RefreshIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useEffect, useRef, useState } from 'react';

import { NuiEvent } from '../../../../shared/event';
import {
    CROSSHAIR_COLORS,
    CROSSHAIR_PRESETS,
    CrosshairConfig,
    CrosshairLines,
    DEFAULT_CROSSHAIR,
} from '../../../../shared/nui/crosshair';
import { fetchNui } from '../../../fetch';
import { CrosshairView } from '../../Crosshair/CrosshairView';

const COMMIT_DELAY = 150;

const BACKGROUNDS: { id: string; label: string; className: string; zoom: number }[] = [
    { id: 'dark', label: 'Sombre', className: 'bg-neutral-900', zoom: 1 },
    { id: 'light', label: 'Clair', className: 'bg-neutral-200', zoom: 1 },
    { id: 'sky', label: 'Ciel', className: 'bg-gradient-to-b from-sky-400 via-sky-200 to-amber-700', zoom: 1 },
    { id: 'zoom', label: 'Zoom ×2', className: 'bg-neutral-900', zoom: 2 },
];

const Section: FunctionComponent<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <div className="mb-[2vh]">
        <div className="mb-[0.8vh] text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">{title}</div>
        <div className="flex flex-col gap-[0.6vh]">{children}</div>
    </div>
);

const Row: FunctionComponent<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="flex items-center justify-between gap-[2vh] rounded-[1vh] bg-white/5 px-[1.6vh] py-[1vh]">
        <span className="text-[1.5vh] font-semibold">{label}</span>
        {children}
    </div>
);

const Toggle: FunctionComponent<{ value: boolean; onChange: (value: boolean) => void }> = ({ value, onChange }) => (
    <button
        onClick={() => onChange(!value)}
        className={classNames('rounded-[0.8vh] px-[1.4vh] py-[0.4vh] text-[1.4vh] font-semibold transition-colors', {
            'bg-emerald-500/80 text-white': value,
            'bg-white/15 text-white/70': !value,
        })}
    >
        {value ? 'Oui' : 'Non'}
    </button>
);

const Slider: FunctionComponent<{
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}> = ({ value, min, max, onChange }) => (
    <div className="flex items-center gap-[1.2vh]">
        <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            className="h-[0.6vh] w-[16vh] cursor-pointer accent-white"
        />
        <span className="w-[3vh] text-right text-[1.4vh] font-semibold tabular-nums">{value}</span>
    </div>
);

type LinesEditorProps = {
    lines: CrosshairLines;
    onChange: (lines: CrosshairLines) => void;
};

const LinesEditor: FunctionComponent<LinesEditorProps> = ({ lines, onChange }) => {
    const change = (patch: Partial<CrosshairLines>) => onChange({ ...lines, ...patch });

    return (
        <>
            <Row label="Afficher">
                <Toggle value={lines.enabled} onChange={enabled => change({ enabled })} />
            </Row>
            <Row label="Opacité">
                <Slider value={lines.opacity} min={0} max={100} onChange={opacity => change({ opacity })} />
            </Row>
            <Row label="Longueur">
                <Slider value={lines.length} min={1} max={30} onChange={length => change({ length })} />
            </Row>
            <Row label="Épaisseur">
                <Slider value={lines.thickness} min={1} max={8} onChange={thickness => change({ thickness })} />
            </Row>
            <Row label="Écart du centre">
                <Slider value={lines.gap} min={0} max={40} onChange={gap => change({ gap })} />
            </Row>
        </>
    );
};

type CrosshairPanelProps = {
    initial: CrosshairConfig;
};

export const CrosshairPanel: FunctionComponent<CrosshairPanelProps> = ({ initial }) => {
    const [config, setConfig] = useState<CrosshairConfig>(initial);
    const [background, setBackground] = useState('dark');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        []
    );

    const apply = (next: CrosshairConfig) => {
        const value = { ...next, customized: true };

        setConfig(value);

        if (timer.current) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => fetchNui(NuiEvent.CrosshairSet, value), COMMIT_DELAY);
    };

    const reset = () => {
        if (timer.current) {
            clearTimeout(timer.current);
        }

        setConfig({ ...DEFAULT_CROSSHAIR });
        fetchNui(NuiEvent.CrosshairReset);
    };

    const current = BACKGROUNDS.find(item => item.id === background) ?? BACKGROUNDS[0];

    return (
        <div className="min-h-0 flex-1 overflow-y-auto pr-[0.6vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
            <div className="mb-[2vh]">
                <div
                    className={classNames(
                        'relative flex h-[22vh] items-center justify-center overflow-hidden rounded-[1.2vh]',
                        current.className
                    )}
                >
                    <div style={{ transform: `scale(${current.zoom})` }}>
                        <CrosshairView config={config} size="9.26vh" />
                    </div>
                </div>
                <div className="mt-[0.8vh] flex gap-[0.6vh]">
                    {BACKGROUNDS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setBackground(item.id)}
                            className={classNames('flex-1 rounded-[0.8vh] py-[0.6vh] text-[1.3vh] font-semibold', {
                                'bg-white text-black': background === item.id,
                                'bg-white/10 text-white/70 hover:bg-white/25': background !== item.id,
                            })}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <Section title="Préréglages">
                <div className="grid grid-cols-6 gap-[0.8vh]">
                    {CROSSHAIR_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => apply(preset.config)}
                            className="flex flex-col items-center gap-[0.4vh] rounded-[1vh] bg-white/5 px-[0.6vh] py-[0.8vh] text-[1.3vh] font-semibold hover:bg-white/15"
                        >
                            <div className="flex h-[5vh] w-full items-center justify-center overflow-hidden rounded-[0.8vh] bg-neutral-900">
                                <CrosshairView config={preset.config} size="5vh" />
                            </div>
                            {preset.label}
                        </button>
                    ))}
                </div>
            </Section>

            <Section title="Général">
                <Row label="Couleur">
                    <div className="flex items-center gap-[0.6vh]">
                        {CROSSHAIR_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => apply({ ...config, color })}
                                className={classNames('h-[2.4vh] w-[2.4vh] rounded-[0.5vh] border', {
                                    'border-white': config.color === color,
                                    'border-transparent': config.color !== color,
                                })}
                                style={{ background: color }}
                            />
                        ))}
                        <input
                            type="color"
                            value={config.color}
                            onChange={event => apply({ ...config, color: event.target.value })}
                            className="h-[2.4vh] w-[3vh] cursor-pointer rounded-[0.5vh] bg-transparent"
                        />
                    </div>
                </Row>
                <Row label="Point central">
                    <Toggle value={config.dot} onChange={dot => apply({ ...config, dot })} />
                </Row>
                <Row label="Style T (sans ligne du haut)">
                    <Toggle value={config.tStyle} onChange={tStyle => apply({ ...config, tStyle })} />
                </Row>
            </Section>

            <Section title="Contour">
                <Row label="Afficher">
                    <Toggle
                        value={config.outline.enabled}
                        onChange={enabled => apply({ ...config, outline: { ...config.outline, enabled } })}
                    />
                </Row>
                <Row label="Opacité">
                    <Slider
                        value={config.outline.opacity}
                        min={0}
                        max={100}
                        onChange={opacity => apply({ ...config, outline: { ...config.outline, opacity } })}
                    />
                </Row>
                <Row label="Épaisseur">
                    <Slider
                        value={config.outline.thickness}
                        min={1}
                        max={4}
                        onChange={thickness => apply({ ...config, outline: { ...config.outline, thickness } })}
                    />
                </Row>
            </Section>

            <Section title="Lignes intérieures">
                <LinesEditor lines={config.inner} onChange={inner => apply({ ...config, inner })} />
            </Section>

            <Section title="Lignes extérieures">
                <LinesEditor lines={config.outer} onChange={outer => apply({ ...config, outer })} />
            </Section>

            <Section title="Anneau">
                <Row label="Afficher">
                    <Toggle
                        value={config.ring.enabled}
                        onChange={enabled => apply({ ...config, ring: { ...config.ring, enabled } })}
                    />
                </Row>
                <Row label="Rayon">
                    <Slider
                        value={config.ring.radius}
                        min={4}
                        max={40}
                        onChange={radius => apply({ ...config, ring: { ...config.ring, radius } })}
                    />
                </Row>
                <Row label="Épaisseur">
                    <Slider
                        value={config.ring.thickness}
                        min={1}
                        max={8}
                        onChange={thickness => apply({ ...config, ring: { ...config.ring, thickness } })}
                    />
                </Row>
            </Section>

            <button
                onClick={reset}
                className="mb-[1vh] flex items-center gap-[0.8vh] rounded-[1vh] bg-red-500/20 px-[1.6vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase text-red-200 transition-colors hover:bg-red-500/60 hover:text-white"
            >
                <RefreshIcon className="h-[1.8vh] w-[1.8vh]" />
                Réinitialiser le viseur
            </button>
        </div>
    );
};
