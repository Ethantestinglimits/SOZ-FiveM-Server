import cn from 'classnames';
import { FunctionComponent, PropsWithChildren } from 'react';

import { HudPosition } from '../../../shared/nui/hud_layout';
import { layoutTransform } from './hudLayoutState';

type LayoutBlockProps = {
    position: HudPosition;
    anchor: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    className?: string;
};

export const LayoutBlock: FunctionComponent<PropsWithChildren<LayoutBlockProps>> = ({
    position,
    anchor,
    className,
    children,
}) => {
    const placement = {
        'bottom-left': { left: `${position.x}vw`, bottom: `${100 - position.y}vh` },
        'bottom-right': { right: `${100 - position.x}vw`, bottom: `${100 - position.y}vh` },
        'top-left': { left: `${position.x}vw`, top: `${position.y}vh` },
        'top-right': { right: `${100 - position.x}vw`, top: `${position.y}vh` },
    }[anchor];

    return (
        <div
            className={cn('absolute', className)}
            style={{ ...placement, ...layoutTransform(position, anchor.replace('-', ' ')) }}
        >
            {children}
        </div>
    );
};
