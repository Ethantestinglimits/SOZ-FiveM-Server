import { FunctionComponent, ReactNode } from 'react';

type MousePart = 'left' | 'right' | 'middle' | 'up' | 'down' | 'back' | 'forward';

const MOUSE_PARTS: Record<string, MousePart> = {
    b_100: 'left',
    b_101: 'right',
    b_102: 'middle',
    b_103: 'back',
    b_104: 'forward',
    b_115: 'up',
    b_116: 'down',
};

const DPAD_DIRECTIONS: Record<string, number> = {
    b_4: 0,
    b_7: 90,
    b_5: 180,
    b_6: 270,
};

const FACE_BUTTONS: Record<string, { letter: string; color: string }> = {
    b_30: { letter: 'A', color: '#6cc04a' },
    b_31: { letter: 'B', color: '#e2403a' },
};

const GAMEPAD_BUTTON_LIMIT = 100;

const Svg: FunctionComponent<{ children: ReactNode }> = ({ children }) => (
    <svg viewBox="0 0 24 24" className="h-[2.6vh] w-[2.6vh]" fill="none" stroke="white" strokeWidth={1.6}>
        {children}
    </svg>
);

const MOUSE_ACCENT = '#f5a623';
const MOUSE_LINE = '#1b1d22';

const MouseGlyph: FunctionComponent<{ part: MousePart }> = ({ part }) => (
    <svg viewBox="0 0 24 24" className="h-[2.6vh] w-[2.6vh]">
        <rect x={6} y={3.5} width={12} height={17} rx={6} fill="white" />
        {part === 'left' && <path d="M12 3.5a6 6 0 0 0-6 6v1h6z" fill={MOUSE_ACCENT} />}
        {part === 'right' && <path d="M12 3.5a6 6 0 0 1 6 6v1h-6z" fill={MOUSE_ACCENT} />}
        <path d="M6 10.5h12M12 3.5v7" stroke={MOUSE_LINE} strokeWidth={1.2} />
        <rect
            x={10.8}
            y={5.5}
            width={2.4}
            height={3.6}
            rx={1.2}
            fill={part === 'middle' || part === 'up' || part === 'down' ? MOUSE_ACCENT : MOUSE_LINE}
        />
        {part === 'up' && <path d="M12 0.3l-2.4 2.4h4.8z" fill={MOUSE_ACCENT} />}
        {part === 'down' && <path d="M12 23.7l-2.4-2.4h4.8z" fill={MOUSE_ACCENT} />}
        {(part === 'back' || part === 'forward') && (
            <rect x={2.6} y={part === 'back' ? 13.6 : 10.4} width={3.4} height={2.8} rx={0.8} fill={MOUSE_ACCENT} />
        )}
    </svg>
);

const DpadGlyph: FunctionComponent<{ rotation: number }> = ({ rotation }) => (
    <Svg>
        <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" strokeLinejoin="round" />
        <path d="M9.6 3.6h4.8v5.4H9.6z" fill="white" stroke="none" transform={`rotate(${rotation} 12 12)`} />
    </Svg>
);

const FaceButtonGlyph: FunctionComponent<{ letter: string; color: string }> = ({ letter, color }) => (
    <svg viewBox="0 0 24 24" className="h-[2.6vh] w-[2.6vh]">
        <circle cx={12} cy={12} r={10} fill={color} />
        <text x={12} y={16.2} textAnchor="middle" fontSize={12} fontWeight={700} fill="white">
            {letter}
        </text>
    </svg>
);

const GamepadGlyph: FunctionComponent = () => (
    <Svg>
        <path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1.2 4a2.4 2.4 0 0 1-4 1L14.4 16H9.6l-2.2 2.4a2.4 2.4 0 0 1-4-1l-1.2-4A5 5 0 0 1 7 7z" />
        <path d="M7.5 10v3.4M5.8 11.7h3.4" />
        <circle cx={16} cy={10.6} r={0.9} fill="white" stroke="none" />
        <circle cx={17.8} cy={12.6} r={0.9} fill="white" stroke="none" />
    </Svg>
);

export const keyGlyph = (key?: string): ReactNode | null => {
    if (!key) {
        return null;
    }

    if (MOUSE_PARTS[key]) {
        return <MouseGlyph part={MOUSE_PARTS[key]} />;
    }

    if (DPAD_DIRECTIONS[key] !== undefined) {
        return <DpadGlyph rotation={DPAD_DIRECTIONS[key]} />;
    }

    if (FACE_BUTTONS[key]) {
        return <FaceButtonGlyph {...FACE_BUTTONS[key]} />;
    }

    if (key.startsWith('b_') && Number(key.slice(2)) >= 0 && Number(key.slice(2)) < GAMEPAD_BUTTON_LIMIT) {
        return <GamepadGlyph />;
    }

    return null;
};
