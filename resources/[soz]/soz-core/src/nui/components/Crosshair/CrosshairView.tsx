import { FunctionComponent, ReactNode } from 'react';

import { CrosshairConfig, CrosshairLines } from '../../../shared/nui/crosshair';

const VIEW_SIZE = 100;

type CrosshairViewProps = {
    config: CrosshairConfig;
    size: string;
};

const linesFor = (lines: CrosshairLines, tStyle: boolean, offset: number) => {
    const start = offset + lines.gap;
    const end = start + lines.length;
    const segments = [
        { x1: -end, y1: 0, x2: -start, y2: 0 },
        { x1: start, y1: 0, x2: end, y2: 0 },
        { x1: 0, y1: start, x2: 0, y2: end },
    ];

    if (!tStyle) {
        segments.push({ x1: 0, y1: -end, x2: 0, y2: -start });
    }

    return segments;
};

export const CrosshairView: FunctionComponent<CrosshairViewProps> = ({ config, size }) => {
    const { color, outline, dot, inner, outer, ring, tStyle } = config;
    const shapes: ReactNode[] = [];

    const addLines = (key: string, lines: CrosshairLines, offset: number) => {
        if (!lines.enabled) {
            return;
        }

        linesFor(lines, tStyle, offset).forEach((segment, index) => {
            if (outline.enabled) {
                shapes.push(
                    <line
                        key={`${key}-outline-${index}`}
                        {...segment}
                        stroke="#000000"
                        strokeOpacity={(outline.opacity / 100) * (lines.opacity / 100)}
                        strokeWidth={lines.thickness + outline.thickness * 2}
                        strokeLinecap="square"
                    />
                );
            }

            shapes.push(
                <line
                    key={`${key}-${index}`}
                    {...segment}
                    stroke={color}
                    strokeOpacity={lines.opacity / 100}
                    strokeWidth={lines.thickness}
                    strokeLinecap="square"
                />
            );
        });
    };

    addLines('outer', outer, inner.enabled ? inner.length : 0);
    addLines('inner', inner, 0);

    if (ring.enabled) {
        if (outline.enabled) {
            shapes.push(
                <circle
                    key="ring-outline"
                    r={ring.radius}
                    fill="none"
                    stroke="#000000"
                    strokeOpacity={outline.opacity / 100}
                    strokeWidth={ring.thickness + outline.thickness * 2}
                />
            );
        }

        shapes.push(<circle key="ring" r={ring.radius} fill="none" stroke={color} strokeWidth={ring.thickness} />);
    }

    if (dot) {
        if (outline.enabled) {
            shapes.push(
                <circle key="dot-outline" r={1.5 + outline.thickness} fill="#000000" fillOpacity={outline.opacity / 100} />
            );
        }

        shapes.push(<circle key="dot" r={1.5} fill={color} />);
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox={`${-VIEW_SIZE / 2} ${-VIEW_SIZE / 2} ${VIEW_SIZE} ${VIEW_SIZE}`}
            style={{ overflow: 'visible' }}
        >
            {shapes}
        </svg>
    );
};
