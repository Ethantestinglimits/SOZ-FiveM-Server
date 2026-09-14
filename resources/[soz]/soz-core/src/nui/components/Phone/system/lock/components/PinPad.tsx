import { animated, useSpring } from '@react-spring/web';
import clsx from 'clsx';
import { FunctionComponent, useEffect } from 'react';

import { PHONE_PIN_CODE_LENGTH } from '../../../../../../shared/phone/device';

const KEYS = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
];

type PinPadProps = {
    value: string;
    onChange: (value: string) => void;
    onComplete: (value: string) => void;
    errorKey?: number;
    disabled?: boolean;
    variant?: 'light' | 'dark';
    leftAction?: { label: string; onClick: () => void };
};

export const PinPad: FunctionComponent<PinPadProps> = ({
    value,
    onChange,
    onComplete,
    errorKey = 0,
    disabled = false,
    variant = 'dark',
    leftAction,
}) => {
    const [shakeStyles, shakeApi] = useSpring(() => ({ x: 0 }));

    useEffect(() => {
        if (errorKey === 0) {
            return;
        }

        shakeApi.start({
            from: { x: 0 },
            to: [{ x: -16 }, { x: 16 }, { x: -12 }, { x: 12 }, { x: -6 }, { x: 0 }],
            config: { duration: 55 },
        });
    }, [errorKey]);

    const press = (digit: string) => {
        if (disabled || value.length >= PHONE_PIN_CODE_LENGTH) {
            return;
        }

        const nextValue = value + digit;

        onChange(nextValue);

        if (nextValue.length === PHONE_PIN_CODE_LENGTH) {
            onComplete(nextValue);
        }
    };

    const erase = () => {
        if (disabled || value.length === 0) {
            return;
        }

        onChange(value.slice(0, -1));
    };

    const isDark = variant === 'dark';

    const keyClassName = clsx(
        'flex flex-col items-center justify-center w-[84px] h-[84px] rounded-full select-none transition-colors duration-150',
        {
            'bg-white/20 active:bg-white/50 text-white': isDark,
            'bg-black/10 active:bg-black/25 text-black': !isDark,
            'opacity-40': disabled,
        }
    );

    return (
        <div className="flex flex-col items-center">
            <animated.div style={shakeStyles} className="flex gap-6 mb-12">
                {Array.from({ length: PHONE_PIN_CODE_LENGTH }).map((_, index) => (
                    <div
                        key={index}
                        className={clsx(
                            'w-[14px] h-[14px] rounded-full border-[1.5px] transition-colors duration-100',
                            {
                                'border-white': isDark,
                                'border-black': !isDark,
                                'bg-white': isDark && index < value.length,
                                'bg-black': !isDark && index < value.length,
                            }
                        )}
                    />
                ))}
            </animated.div>

            <div className="grid grid-cols-3 gap-x-7 gap-y-4">
                {KEYS.map(key => (
                    <button key={key.digit} className={keyClassName} onClick={() => press(key.digit)}>
                        <span className="text-[36px] leading-none font-light">{key.digit}</span>
                        <span className="text-[10px] leading-3 tracking-[0.2em] font-semibold h-3">{key.letters}</span>
                    </button>
                ))}

                {leftAction ? (
                    <button
                        className={clsx(
                            'flex items-center justify-center w-[84px] h-[84px] text-[17px] font-semibold select-none',
                            {
                                'text-white': isDark,
                                'text-black': !isDark,
                            }
                        )}
                        onClick={leftAction.onClick}
                    >
                        {leftAction.label}
                    </button>
                ) : (
                    <div />
                )}

                <button className={keyClassName} onClick={() => press('0')}>
                    <span className="text-[36px] leading-none font-light">0</span>
                </button>

                <button
                    className={clsx('flex items-center justify-center w-[84px] h-[84px] text-[17px] select-none', {
                        'text-white': isDark,
                        'text-black': !isDark,
                        invisible: value.length === 0,
                    })}
                    onClick={erase}
                >
                    Effacer
                </button>
            </div>
        </div>
    );
};
