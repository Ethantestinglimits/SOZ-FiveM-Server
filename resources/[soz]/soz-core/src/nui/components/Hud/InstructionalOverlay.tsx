import { animated, useSpring } from '@react-spring/web';
import cn from 'classnames';
import { useState } from 'react';
import { useSelector } from 'react-redux';

import { bindKeyToName, BindName } from '../../../shared/utils/bind';
import { useHudHasStreetNames, useHudMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { RootState } from '../../store';
import { formatText } from '../../utils/gta-format';
import { GlassMorphismContainer } from '../Styleguide/GlassMorphismContainer';
import { layoutTransform, useHudLayout } from './hudLayoutState';

const cleanText = (string: string) => {
    const formatted = formatText(string);

    return formatted.replace(/^~/, '').replace(/~$/, '');
};

const shouldBeDisplayAsKey = (string: string) =>
    BindName[string] || (string.startsWith('~') && string.endsWith('~'));

export const InstructionalContent = ({ text }: { text: string[] }) => (
    <GlassMorphismContainer
        borderClassName="rounded-full"
        className="flex items-center gap-2 text-white px-5 py-1.5 w-full h-10"
        disableGameClone={text.length === 0}
    >
        {text.map(t => (
            <span
                key={t}
                className={cn({
                    'bg-white/10 border border-slate-300/10 px-2 rounded-md': shouldBeDisplayAsKey(t),
                })}
                dangerouslySetInnerHTML={{
                    __html: BindName[t] ? bindKeyToName(BindName[t]) : cleanText(t),
                }}
            />
        ))}
    </GlassMorphismContainer>
);

export function InstructionalOverlay() {
    const minimap = useHudMinimap();
    const showInstructionalOverlay = useSelector((state: RootState) => state.hud.settings.showInstructionalOverlay);
    const hasStreetNamesEnabled = useHudHasStreetNames();

    const [text, setText] = useState<string[]>([]);
    const [forceDisplay, setForceDisplay] = useState(false);

    const layout = useHudLayout().instructions;

    const styles = useSpring({
        from: {
            opacity: 0,
        },
        to: {
            opacity: 1,
            top: text.length > 0 ? (layout ? `${layout.y}vh` : `${100 - minimap.bottom * 100}vh`) : '-50vh',
            marginLeft: layout ? `${2 * (layout.x - 50)}vw` : '0vw',
        },
    });

    useNuiEvent('hud', 'SetInstructional', setText);
    useNuiEvent('hud', 'ForceDisplayInstructional', setForceDisplay);

    if (!forceDisplay && !showInstructionalOverlay) {
        return null;
    }

    return (
        <animated.div
            className={cn('absolute inset-x-0 flex justify-center', {
                '-mt-12': hasStreetNamesEnabled && !layout,
            })}
            style={styles}
        >
            <div className="h-10 w-fit" style={layoutTransform(layout, 'top center')}>
                <InstructionalContent text={text} />
            </div>
        </animated.div>
    );
}
