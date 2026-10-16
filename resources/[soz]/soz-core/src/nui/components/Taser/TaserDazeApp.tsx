import { useNuiEvent } from '@public/nui/hook/nui';
import { useInterval } from '@public/nui/hook/useInterval';
import { FunctionComponent, useState } from 'react';

type Arc = {
    points: string;
    width: number;
};

type Frame = {
    arcs: Arc[];
    opacity: number;
    offsetX: number;
    offsetY: number;
    scanlineOffset: number;
};

const FRAME_INTERVAL_MS = 60;

const MAX_SHAKE_PX = 8;

const MAX_ARCS = 4;

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const SCREEN_EDGES = [
    { x: 0, y: null, angle: 0 },
    { x: 100, y: null, angle: Math.PI },
    { x: null, y: 0, angle: Math.PI / 2 },
    { x: null, y: 100, angle: -Math.PI / 2 },
];

const createArc = (intensity: number): Arc => {
    const edge = SCREEN_EDGES[Math.floor(Math.random() * SCREEN_EDGES.length)];
    const along = randomBetween(5, 95);

    let x = edge.x ?? along;
    let y = edge.y ?? along;
    let angle = edge.angle + randomBetween(-0.6, 0.6);

    const points = [`${x.toFixed(1)},${y.toFixed(1)}`];
    const segments = Math.round(randomBetween(4, 6 + 6 * intensity));

    for (let i = 0; i < segments; i++) {
        angle += randomBetween(-0.9, 0.9);

        const length = randomBetween(2, 6);

        x += Math.cos(angle) * length;
        y += Math.sin(angle) * length;

        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return {
        points: points.join(' '),
        width: randomBetween(1, 1 + 2.5 * intensity),
    };
};

const createFrame = (intensity: number): Frame => {
    const arcCount = Math.random() < 0.3 + 0.6 * intensity ? Math.ceil(Math.random() * MAX_ARCS * intensity) : 0;
    const shake = MAX_SHAKE_PX * intensity;

    return {
        arcs: Array.from({ length: arcCount }, () => createArc(intensity)),
        opacity: intensity * randomBetween(0.55, 1),
        offsetX: randomBetween(-shake, shake),
        offsetY: randomBetween(-shake, shake),
        scanlineOffset: Math.random() * 6,
    };
};

export const TaserDazeApp: FunctionComponent = () => {
    const [intensity, setIntensity] = useState<number>(0);
    const [frame, setFrame] = useState<Frame | null>(null);

    useNuiEvent('taser', 'setDazeIntensity', (value) => {
        setIntensity(value);

        if (value <= 0) {
            setFrame(null);
        }
    });

    useInterval(() => {
        if (intensity <= 0) {
            return;
        }

        setFrame(createFrame(intensity));
    }, FRAME_INTERVAL_MS);

    if (intensity <= 0 || !frame) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 pointer-events-none"
            style={{
                opacity: frame.opacity,
                transform: `translate(${frame.offsetX.toFixed(1)}px, ${frame.offsetY.toFixed(1)}px) scale(1.03)`,
            }}
        >
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse at center, rgba(120,180,255,0) 45%, rgba(120,180,255,0.25) 75%, rgba(200,230,255,0.55) 100%)',
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    opacity: 0.35,
                    backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(220,240,255,0.25) 0px, rgba(220,240,255,0.25) 1px, transparent 1px, transparent 6px)',
                    backgroundPosition: `0 ${frame.scanlineOffset.toFixed(1)}px`,
                }}
            />
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                    filter: 'drop-shadow(0 0 4px rgba(140,200,255,0.9)) drop-shadow(0 0 10px rgba(90,150,255,0.7))',
                }}
            >
                {frame.arcs.map((arc, index) => (
                    <polyline
                        key={index}
                        points={arc.points}
                        fill="none"
                        stroke="rgba(235,245,255,0.95)"
                        strokeWidth={arc.width}
                        strokeLinejoin="miter"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
            </svg>
        </div>
    );
};
