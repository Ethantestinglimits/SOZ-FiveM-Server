import classNames from 'classnames';
import { FunctionComponent, ReactNode } from 'react';

import {
    DEFAULT_MINIMAP_STYLE,
    MINIMAP_BORDER_MAX,
    MINIMAP_OPACITY_MIN,
    MINIMAP_RADIUS_MAX,
    MinimapFrameMode,
    MinimapShape,
    MinimapStyle,
} from '../../../shared/nui/hud_layout';

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
    <div className="flex items-center justify-between gap-[1.6vh]">
        <span className="text-[1.4vh] font-semibold">{label}</span>
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
    <div className="flex items-center gap-[1vh]">
        <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-[0.6vh] w-[12vh] cursor-pointer accent-white"
        />
        <span className="w-[4.4vh] text-right text-[1.3vh] font-semibold tabular-nums">
            {value}
            {suffix}
        </span>
    </div>
);

type MinimapStylePanelProps = {
    style: MinimapStyle;
    defaultRadius: number;
    onChange: (style: MinimapStyle) => void;
    onReset: () => void;
};

export const MinimapStylePanel: FunctionComponent<MinimapStylePanelProps> = ({
    style,
    defaultRadius,
    onChange,
    onReset,
}) => {
    const change = (patch: Partial<MinimapStyle>) => onChange({ ...style, ...patch });
    const radius = style.radius ?? defaultRadius;

    return (
        <div
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute left-[2vh] top-[3vh] flex w-[34vh] flex-col gap-[1.2vh] rounded-[1.2vh] bg-black/85 p-[1.6vh]"
        >
            <div className="text-[1.3vh] font-semibold uppercase tracking-[0.2em] text-white/50">Minimap</div>

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
                <Row label="Couleur">
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
                onClick={onReset}
                disabled={JSON.stringify(style) === JSON.stringify(DEFAULT_MINIMAP_STYLE)}
                className="self-start rounded-[0.8vh] bg-white/15 px-[1.4vh] py-[0.5vh] text-[1.3vh] font-semibold hover:bg-white/30 disabled:cursor-default disabled:text-white/40 disabled:hover:bg-white/15"
            >
                Réinitialiser l'apparence
            </button>
        </div>
    );
};
