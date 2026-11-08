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
import { screenWidthToPx } from '../../../utils/screenFrame';
import { MinimapPreview } from '../../Minimap/MinimapPreview';
import { MINIMAP_RADIUS } from '../../Minimap/minimapRenderer';
import { setMinimapStyle, useMinimapStyle } from '../../Minimap/minimapStyleState';
import { navGroup, navSelected } from '../keyboardNav';
import { Arrow, ROW_CLASS, ROW_LABEL_CLASS, ValueStepper } from './rowControls';

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
    <div className={ROW_CLASS}>
        <span className={ROW_LABEL_CLASS}>{label}</span>
        {children}
    </div>
);

const Cycle: FunctionComponent<{
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
}> = ({ options, value, onChange }) => {
    const index = Math.max(
        0,
        options.findIndex(option => option.id === value)
    );

    return (
        <ValueStepper
            label={options[index].label}
            index={index}
            count={options.length}
            onChange={direction => onChange(options[(index + direction + options.length) % options.length].id)}
        />
    );
};

const Slider: FunctionComponent<{
    value: number;
    min: number;
    max: number;
    suffix: string;
    onChange: (value: number) => void;
}> = ({ value, min, max, suffix, onChange }) => {
    const percent = ((value - min) / Math.max(1, max - min)) * 100;

    return (
        <div className="flex items-center gap-[1vh]">
            <Arrow direction={-1} onPress={() => onChange(Math.max(min, value - 1))} />
            <input
                type="range"
                tabIndex={-1}
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={event => onChange(Number(event.target.value))}
                className="soz-volume-slider w-[16vh]"
                style={{
                    background: `linear-gradient(to right, #fff ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`,
                }}
            />
            <span className="min-w-[4.6vh] text-right text-[1.25vh] font-semibold tabular-nums">
                {value}
                {suffix}
            </span>
            <Arrow direction={1} onPress={() => onChange(Math.min(max, value + 1))} />
        </div>
    );
};

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
        []
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

    const width = screenWidthToPx(minimap.width);
    const height = minimap.height > 0 ? minimap.height * window.innerHeight : width * MINIMAP_RATIO;
    const minSide = Math.max(1, Math.min(width, height));
    const radius = style.radius ?? Math.round((MINIMAP_RADIUS / minSide) * 100);

    return (
        <div className="flex gap-[2.4vh]">
            <div className="flex min-w-0 flex-1 flex-col gap-[0.4vh]">
                <Row label="Forme">
                    <Cycle
                        options={SHAPES}
                        value={style.shape}
                        onChange={shape => change({ shape: shape as MinimapShape })}
                    />
                </Row>

                {style.shape !== 'circle' && (
                    <Row label="Coins arrondis">
                        <Slider
                            value={radius}
                            min={0}
                            max={MINIMAP_RADIUS_MAX}
                            suffix=" %"
                            onChange={value => change({ radius: value })}
                        />
                    </Row>
                )}

                <Row label="Opacité">
                    <Slider
                        value={style.opacity}
                        min={MINIMAP_OPACITY_MIN}
                        max={100}
                        suffix=" %"
                        onChange={opacity => change({ opacity })}
                    />
                </Row>

                <Row label="Bordure">
                    <Slider
                        value={style.borderWidth}
                        min={0}
                        max={MINIMAP_BORDER_MAX}
                        suffix=" px"
                        onChange={borderWidth => change({ borderWidth })}
                    />
                </Row>

                {style.borderWidth > 0 && (
                    <Row label="Couleur de la bordure">
                        <div className="flex items-center gap-[0.6vh]" {...navGroup('select')}>
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    {...navSelected(style.borderColor === color)}
                                    onClick={() => change({ borderColor: color })}
                                    className={classNames('h-[2vh] w-[2vh] rounded-[0.5vh] border', {
                                        'border-white': style.borderColor === color,
                                        'border-transparent': style.borderColor !== color,
                                    })}
                                    style={{ background: color }}
                                />
                            ))}
                            <input
                                type="color"
                                value={style.borderColor}
                                onChange={event => change({ borderColor: event.target.value })}
                                className="h-[2vh] w-[2.6vh] cursor-pointer rounded-[0.5vh] bg-transparent"
                            />
                        </div>
                    </Row>
                )}

                <Row label="Cadre de la montre">
                    <Cycle
                        options={FRAMES}
                        value={style.frame}
                        onChange={frame => change({ frame: frame as MinimapFrameMode })}
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
