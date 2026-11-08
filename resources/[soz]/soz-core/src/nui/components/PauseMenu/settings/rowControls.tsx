import classNames from 'classnames';
import { FunctionComponent, HTMLAttributes, ReactNode } from 'react';

const SEGMENT_LIMIT = 12;

export const ROW_CLASS =
    'flex h-[3.6vh] shrink-0 items-center justify-between gap-[2vh] rounded-[0.9vh] bg-white/5 px-[1.6vh] transition-colors hover:bg-white/[0.14] focus:bg-white/[0.14]';

export const ROW_LABEL_CLASS = 'min-w-0 truncate text-[1.35vh] font-semibold';

export const Arrow: FunctionComponent<{ direction: number; onPress: () => void; mouseDown?: boolean }> = ({
    direction,
    onPress,
    mouseDown,
}) => (
    <button
        {...(mouseDown ? { onMouseDown: onPress } : { onClick: onPress })}
        className="flex h-[2.6vh] w-[2.6vh] items-center justify-center rounded-[0.5vh] text-[1.9vh] leading-none text-white/60 transition-colors hover:bg-white/15 hover:text-white"
    >
        {direction < 0 ? '‹' : '›'}
    </button>
);

const Gauge: FunctionComponent<{ index: number; count: number }> = ({ index, count }) =>
    count <= SEGMENT_LIMIT ? (
        <div className="flex gap-[0.3vh]">
            {Array.from({ length: count }, (_, i) => (
                <i
                    key={i}
                    className={classNames('h-[0.25vh] w-[1.6vh] rounded-full', {
                        'bg-white': i === index,
                        'bg-white/25': i !== index,
                    })}
                />
            ))}
        </div>
    ) : (
        <div className="h-[0.25vh] w-[16vh] rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${((index + 1) / count) * 100}%` }} />
        </div>
    );

export const ValueStepper: FunctionComponent<{
    label: ReactNode;
    index?: number;
    count?: number;
    changed?: boolean;
    mouseDown?: boolean;
    disabled?: boolean;
    hover?: HTMLAttributes<HTMLDivElement>;
    onChange: (direction: number) => void;
}> = ({ label, index, count, changed, mouseDown, disabled, hover, onChange }) => (
    <div className="flex items-center gap-[1vh]" {...hover}>
        {disabled ? (
            <span className="w-[2.6vh]" />
        ) : (
            <Arrow direction={-1} onPress={() => onChange(-1)} mouseDown={mouseDown} />
        )}
        <div className="flex min-w-[16vh] flex-col items-center gap-[0.3vh]">
            <span
                className={classNames('text-[1.25vh] font-semibold', {
                    'text-amber-300': changed,
                    'text-white/50': disabled && !changed,
                })}
            >
                {label}
            </span>
            {count > 1 && <Gauge index={index} count={count} />}
        </div>
        {disabled ? (
            <span className="w-[2.6vh]" />
        ) : (
            <Arrow direction={1} onPress={() => onChange(1)} mouseDown={mouseDown} />
        )}
    </div>
);

export const ToggleButton: FunctionComponent<{
    value: boolean;
    changed?: boolean;
    mouseDown?: boolean;
    hover?: HTMLAttributes<HTMLButtonElement>;
    onPress: () => void;
}> = ({ value, changed, mouseDown, hover, onPress }) => (
    <button
        {...hover}
        {...(mouseDown ? { onMouseDown: onPress } : { onClick: onPress })}
        className={classNames(
            'min-w-[5.6vh] rounded-[0.6vh] px-[1vh] py-[0.25vh] text-[1.25vh] font-semibold transition-colors',
            {
                'bg-emerald-500/80 text-white hover:bg-emerald-500': value,
                'bg-white/15 text-white/70 hover:bg-white/25': !value,
                'ring-2 ring-amber-300': changed,
            }
        )}
    >
        {value ? 'Oui' : 'Non'}
    </button>
);

export const Bar: FunctionComponent<{ percent: number }> = ({ percent }) => (
    <div className="h-[0.5vh] w-[16vh] rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
    </div>
);

export const ToasterIcon: FunctionComponent<{ className?: string }> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M7.5 8V5.5a1.5 1.5 0 0 1 3 0V8M13.5 8V5.5a1.5 1.5 0 0 1 3 0V8" />
        <rect x="3" y="8" width="18" height="10" rx="3" />
        <path d="M6.5 18v2M17.5 18v2M21 12h1.5M7 13h6" />
        <circle cx="17" cy="13" r="1" />
    </svg>
);
