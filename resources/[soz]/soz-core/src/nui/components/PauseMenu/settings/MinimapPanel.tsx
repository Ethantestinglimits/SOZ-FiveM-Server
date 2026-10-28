import classNames from 'classnames';
import { FunctionComponent, ReactNode, useEffect, useRef } from 'react';

import { NuiEvent } from '../../../../shared/event';
import {
    DEFAULT_MINIMAP_STYLE,
    MINIMAP_BORDER_MAX,
    MINIMAP_OPACITY_MIN,
    MINIMAP_RADIUS_MAX,
    MinimapFrameMode,
    MinimapShape,
    MinimapStyle,
} from '../../../../shared/nui/minimap';
import { fetchNui } from '../../../fetch';
import { useMinimap } from '../../../hook/data';
import { MinimapPreview } from '../../Minimap/MinimapPreview';
import { MINIMAP_RADIUS } from '../../Minimap/minimapRenderer';
import { setMinimapStyle, useMinimapStyle } from '../../Minimap/minimapStyleState';

const COMMIT_DELAY = 150;
const MINIMAP_RATIO = 4 / 5.674;

const SHAPES: { id: MinimapShape; label: string }[] = [
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'square', label: 'Carré' },
    { id: 'circle', label: 'Cercle' },
];

const FRAMES: { id: MinimapFrameMode; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'visible', label: 'Visible' },
    { id: 'hidden', label: 'Masqué' },
];

const COLORS = ['#ffffff', '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7'];

const Row: FunctionComponent<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="flex items-center justify-between gap-[2vh] rounded-[1vh] bg-white/5 px-[1.6vh] py-[1vh]">
        <span className="text-[1.5vh] font-semibold">{label}</span>
        {children}
    </div>
);

const Segmented: FunctionComponent<{
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
}> = ({ options, value, onChange }) => (
    <div className="flex gap-[0.4vh]">
        {options.map((option) => (
            <button
                key={option.id}
                onClick={() => onChange(option.id)}
                className={classNames('rounded-[0.6vh] px-[1vh] py-[0.4vh] text-[1.3vh] font-semibold', {
                    'bg-white text-black': value === option.id,
                    'bg-white/15 text-white/80 hover:bg-white/30': value !== option.id,
                })}
            >
                {option.label}
            </button>
        ))}
    </div>
);

const Slider: FunctionComponent<{
    value: number;
    min: number;
    max: number;
    suffix: string;
    onChange: (value: number) => void;
}> = ({ value, min, max, suffix, onChange }) => (
    <div className="flex items-center gap-[1.2vh]">
        <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-[0.6vh] w-[16vh] cursor-pointer accent-white"
        />
        <span className="w-[4.4vh] text-right text-[1.4vh] font-semibold tabular-nums">
            {value}
            {suffix}
        </span>
    </div>
);

export const MinimapPanel: FunctionComponent = () => {
    const style = useMinimapStyle();
    const minimap = useMinimap();
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pending = useRef<MinimapStyle | null>(null);

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);

                if (pending.current) {
                    fetchNui(NuiEvent.MinimapStyleSet, pending.current);
                }
            }
        },
        [],
    );

    const apply = (next: MinimapStyle) => {
        setMinimapStyle(next);

        if (timer.current) {
            clearTimeout(timer.current);
        }

        pending.current = next;
        timer.current = setTimeout(() => {
            timer.current = null;
            pending.current = null;
            fetchNui(NuiEvent.MinimapStyleSet, next);
        }, COMMIT_DELAY);
    };

    const change = (patch: Partial<MinimapStyle>) => apply({ ...style, ...patch });

    const width = minimap.width * window.innerWidth;
    const height = minimap.height > 0 ? minimap.height * window.innerHeight : width * MINIMAP_RATIO;
    const minSide = Math.max(1, Math.min(width, height));
    const radius = style.radius ?? Math.round((MINIMAP_RADIUS / minSide) * 100);

    return (
        <div className="flex gap-[2.4vh]">
            <div className="flex min-w-0 flex-1 flex-col gap-[0.6vh]">
                <Row label="Forme">
                    <Segmented
                        options={SHAPES}
                        value={style.shape}
                        onChange={(shape) => change({ shape: shape as MinimapShape })}
                    />
                </Row>

                {style.shape !== 'circle' && (
                    <Row label="Coins arrondis">
                        <Slider
                            value={radius}
                            min={0}
                            max={MINIMAP_RADIUS_MAX}
                            suffix=" %"
                            onChange={(value) => change({ radius: value })}
                        />
                    </Row>
                )}

                <Row label="Opacité">
                    <Slider
                        value={style.opacity}
                        min={MINIMAP_OPACITY_MIN}
                        max={100}
                        suffix=" %"
                        onChange={(opacity) => change({ opacity })}
                    />
                </Row>

                <Row label="Bordure">
                    <Slider
                        value={style.borderWidth}
                        min={0}
                        max={MINIMAP_BORDER_MAX}
                        suffix=" px"
                        onChange={(borderWidth) => change({ borderWidth })}
                    />
                </Row>

                {style.borderWidth > 0 && (
                    <Row label="Couleur de la bordure">
                        <div className="flex items-center gap-[0.6vh]">
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => change({ borderColor: color })}
                                    className={classNames('h-[2.2vh] w-[2.2vh] rounded-[0.5vh] border', {
                                        'border-white': style.borderColor === color,
                                        'border-transparent': style.borderColor !== color,
                                    })}
                                    style={{ background: color }}
                                />
                            ))}
                            <input
                                type="color"
                                value={style.borderColor}
                                onChange={(event) => change({ borderColor: event.target.value })}
                                className="h-[2.2vh] w-[2.8vh] cursor-pointer rounded-[0.5vh] bg-transparent"
                            />
                        </div>
                    </Row>
                )}

                <Row label="Cadre de la montre">
                    <Segmented
                        options={FRAMES}
                        value={style.frame}
                        onChange={(frame) => change({ frame: frame as MinimapFrameMode })}
                    />
                </Row>

                <button
                    onClick={() => apply(DEFAULT_MINIMAP_STYLE)}
                    disabled={JSON.stringify(style) === JSON.stringify(DEFAULT_MINIMAP_STYLE)}
                    className="mt-[0.6vh] self-start rounded-[1vh] bg-white/10 px-[1.8vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase transition-colors hover:bg-white/25 disabled:cursor-default disabled:text-white/40 disabled:hover:bg-white/10"
                >
                    Réinitialiser l'apparence
                </button>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-[1vh] rounded-[1vh] bg-white/5 p-[1.6vh]">
                <span className="self-start text-[1.2vh] font-semibold uppercase tracking-[0.2em] text-white/50">
                    Aperçu
                </span>
                <div className="flex flex-1 items-center justify-center">
                    <MinimapPreview />
                </div>
            </div>
        </div>
    );
};
