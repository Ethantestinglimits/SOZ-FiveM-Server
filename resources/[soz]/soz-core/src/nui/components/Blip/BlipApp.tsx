import { FunctionComponent, useEffect, useState } from 'react';

import { NuiEvent } from '../../../shared/event/nui';
import { BlipAction, BlipInfo } from '../../../shared/nui/blip';
import { fetchNui } from '../../fetch';
import { useNuiEvent, useNuiFocus } from '../../hook/nui';
import { useOutside } from '../../hook/outside';
import { getBlipAnchor, getMinimapMode, minimapController } from '../Minimap/minimapState';
import { GlassMorphismContainer } from '../Styleguide/GlassMorphismContainer';

export const BlipApp: FunctionComponent = () => {
    const [actions, setActions] = useState<BlipAction[]>([]);
    const [info, setInfo] = useState<BlipInfo | null>(null);
    const [isPauseMenuActive, setIsPauseMenuActive] = useState(false);
    const [isOver, setIsOver] = useState(false);

    useNuiEvent('blip', 'SetActions', setActions);
    useNuiEvent('blip', 'SetInfo', setInfo);
    useNuiEvent('global', 'PauseMenuActive', active => {
        if (actions.length > 0 && !active && getMinimapMode() === 'minimap') {
            setActions([]);
        }

        setIsPauseMenuActive(active);
    });

    useNuiFocus(actions.length > 0, actions.length > 0 && isOver, false);

    useEffect(() => {
        if (actions.length === 0) {
            minimapController.renderer?.releaseContextPoint();
        }
    }, [actions]);

    useEffect(() => {
        if (actions.length > 0) {
            fetchNui(NuiEvent.SetShowCursor, { showCursor: isPauseMenuActive && !isOver });
        } else {
            fetchNui(NuiEvent.SetShowCursor, { showCursor: isPauseMenuActive });
        }
    }, [actions, isOver, isPauseMenuActive]);

    const refOutside = useOutside({
        click: () => setActions([]),
        contextMenu: () => setActions([]),
    });

    if (actions.length === 0) {
        return null;
    }

    const anchor = getMinimapMode() === 'open' ? getBlipAnchor() : null;

    return (
        <main
            className="pointer-events-none absolute z-[100] flex flex-col items-center inset-0 h-full w-full overflow-hidden"
            style={{ cursor: 'none' }}
        >
            <div
                className={anchor ? 'pointer-events-auto absolute' : 'pointer-events-auto mt-[52vh]'}
                style={anchor ? { left: anchor.x, top: anchor.y + 16, transform: 'translateX(-50%)' } : undefined}
            >
                <GlassMorphismContainer>
                    <div ref={refOutside}>
                        {info && (
                            <div className="flex items-center justify-between gap-4 border-b border-white/20 p-2 text-white">
                                <span className="font-semibold">{info.name}</span>
                                {info.total > 1 && (
                                    <span className="tabular-nums text-white/60">
                                        {info.index}/{info.total}
                                    </span>
                                )}
                            </div>
                        )}
                        {actions.map((action, i) => {
                            return (
                                <div key={i}>
                                    <div
                                        className="flex text-white cursor-pointer items-center justify-between w-full p-2 rounded-md transition-colors hover:bg-white/20"
                                        onClick={() => {
                                            setActions([]);
                                            setIsOver(false);
                                            fetchNui(NuiEvent.BlipAction, {
                                                blipId: action.blipId,
                                                id: action.id,
                                            });
                                        }}
                                        onMouseEnter={() => setIsOver(true)}
                                        onMouseLeave={() => setIsOver(false)}
                                    >
                                        {action.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassMorphismContainer>
            </div>
        </main>
    );
};
