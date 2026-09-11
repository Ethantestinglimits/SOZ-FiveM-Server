import { FunctionComponent, useEffect, useRef, useState } from 'react';

import { hexToRgb, hsvToRgb, RGBColor, rgbToHex, rgbToHsv } from '../../../shared/color';

type ColorPickerProps = {
    value?: RGBColor;
    onChange: (color: RGBColor) => void;
};

const DEFAULT_COLOR: RGBColor = [255, 255, 255];

export const ColorPicker: FunctionComponent<ColorPickerProps> = ({ value, onChange }) => {
    const squareRef = useRef<HTMLDivElement>(null);
    const hueRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef<'square' | 'hue' | null>(null);
    const frameRef = useRef<number | null>(null);

    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(0);
    const [brightness, setBrightness] = useState(100);
    const [hexInput, setHexInput] = useState('#ffffff');

    const rgb = hsvToRgb([hue, saturation, brightness]);

    useEffect(() => {
        if (draggingRef.current) {
            return;
        }

        const [h, s, v] = rgbToHsv(value ?? DEFAULT_COLOR);
        setHue(h);
        setSaturation(s);
        setBrightness(v);
    }, [value]);

    useEffect(() => {
        setHexInput(rgbToHex(rgb));
    }, [rgb[0], rgb[1], rgb[2]]);

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    const emitChange = (newHue: number, newSaturation: number, newBrightness: number) => {
        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = requestAnimationFrame(() => {
            onChange(hsvToRgb([newHue, newSaturation, newBrightness]));
        });
    };

    const updateFromSquare = (clientX: number, clientY: number) => {
        const square = squareRef.current;

        if (!square) {
            return;
        }

        const rect = square.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        const newSaturation = x * 100;
        const newBrightness = (1 - y) * 100;

        setSaturation(newSaturation);
        setBrightness(newBrightness);
        emitChange(hue, newSaturation, newBrightness);
    };

    const updateFromHue = (clientX: number) => {
        const hueBar = hueRef.current;

        if (!hueBar) {
            return;
        }

        const rect = hueBar.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newHue = x * 360;

        setHue(newHue);
        emitChange(newHue, saturation, brightness);
    };

    const onSquarePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = 'square';
        updateFromSquare(event.clientX, event.clientY);
    };

    const onSquarePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (draggingRef.current !== 'square') {
            return;
        }

        event.stopPropagation();
        updateFromSquare(event.clientX, event.clientY);
    };

    const onHuePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = 'hue';
        updateFromHue(event.clientX);
    };

    const onHuePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (draggingRef.current !== 'hue') {
            return;
        }

        event.stopPropagation();
        updateFromHue(event.clientX);
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        draggingRef.current = null;
    };

    const commitRgb = (newRgb: RGBColor) => {
        const [h, s, v] = rgbToHsv(newRgb);
        setHue(h);
        setSaturation(s);
        setBrightness(v);
        onChange(newRgb);
    };

    const onHexInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.stopPropagation();
        setHexInput(event.target.value);
    };

    const commitHexInput = () => {
        const parsed = hexToRgb(hexInput);

        if (parsed) {
            commitRgb(parsed);
        } else {
            setHexInput(rgbToHex(rgb));
        }
    };

    const cursorLeft = saturation;
    const cursorTop = 100 - brightness;
    const huePosition = (hue / 360) * 100;
    const rgbCss = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    return (
        <div className="flex flex-col gap-1.5 w-full" onClick={event => event.stopPropagation()}>
            <div
                ref={squareRef}
                className="relative rounded-lg w-full"
                style={{
                    height: 90,
                    cursor: 'crosshair',
                    backgroundColor: `hsl(${hue}, 100%, 50%)`,
                    backgroundImage:
                        'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))',
                }}
                onPointerDown={onSquarePointerDown}
                onPointerMove={onSquarePointerMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
            >
                <div
                    className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow pointer-events-none"
                    style={{
                        left: `${cursorLeft}%`,
                        top: `${cursorTop}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: rgbCss,
                    }}
                />
            </div>
            <div
                ref={hueRef}
                className="relative w-full rounded-full shrink-0"
                style={{
                    height: 8,
                    cursor: 'pointer',
                    background: 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)',
                }}
                onPointerDown={onHuePointerDown}
                onPointerMove={onHuePointerMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
            >
                <div
                    className="absolute top-1/2 rounded-full border-2 border-white shadow pointer-events-none"
                    style={{
                        width: 14,
                        height: 14,
                        left: `${huePosition}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: `hsl(${hue}, 100%, 50%)`,
                    }}
                />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-white/15 bg-black/30 px-2.5 py-0.5">
                <div className="flex-1 text-center">
                    <div className="text-[8px] uppercase tracking-widest text-white/50 leading-tight">Hex</div>
                    <input
                        type="text"
                        value={hexInput}
                        onChange={onHexInputChange}
                        onBlur={commitHexInput}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                commitHexInput();
                            }
                        }}
                        onClick={event => event.stopPropagation()}
                        className="bg-transparent text-white text-xs text-center w-full outline-none leading-tight"
                    />
                </div>
            </div>
        </div>
    );
};
