import { LocationMarkerIcon, TrashIcon } from '@heroicons/react/outline';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

import { NuiEvent } from '../../../../../shared/event';
import { PauseMapPlayer, PauseMapPoint } from '../../../../../shared/nui/pause_menu';
import { fetchNui } from '../../../../fetch';
import { PauseMapRenderer } from '../../../PauseMenu/pauseMapRenderer';
import { AppContainer } from '../../components/system/AppContainer';
import { AppWrapper } from '../../components/system/AppWrapper';

export const GpsApp: FunctionComponent = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PauseMapRenderer | null>(null);
    const [player, setPlayer] = useState<PauseMapPlayer | null>(null);
    const [point, setPoint] = useState<PauseMapPoint | null>(null);

    useEffect(() => {
        fetchNui<null, number[]>(NuiEvent.GetPlayerPosition).then(position => {
            if (position) {
                setPlayer({ x: position[0], y: position[1], heading: 0 });
            }
        });
    }, []);

    useEffect(() => {
        if (!player || !canvasRef.current) {
            return;
        }

        const renderer = new PauseMapRenderer(canvasRef.current, player, {
            onHover: () => undefined,
            onClick: newPoint => {
                setPoint(newPoint);
                fetchNui(NuiEvent.PlayerMenuGpsSetPersonalPointAt, newPoint);
            },
            onRightClick: () => {
                setPoint(null);
                fetchNui(NuiEvent.PlayerMenuGpsClearPersonalPoint);
            },
        });

        renderer.layers = [];
        rendererRef.current = renderer;

        const observer = new ResizeObserver(([entry]) => {
            renderer.resize(entry.contentRect.width, entry.contentRect.height);
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            renderer.destroy();
            rendererRef.current = null;
        };
    }, [player]);

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.waypoint = point;
            rendererRef.current.invalidate();
        }
    }, [point]);

    return (
        <AppContainer disableBackground>
            <AppWrapper className="relative" scrollable={false}>
                <div ref={containerRef} className="relative h-full w-full overflow-hidden">
                    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

                    <div className="absolute left-3 top-3 z-10 flex gap-2">
                        <button
                            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white"
                            onClick={() => player && rendererRef.current?.focus(player)}
                        >
                            <LocationMarkerIcon className="h-4 w-4" />
                            Me localiser
                        </button>
                        {point && (
                            <button
                                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white"
                                onClick={() => {
                                    setPoint(null);
                                    fetchNui(NuiEvent.PlayerMenuGpsClearPersonalPoint);
                                }}
                            >
                                <TrashIcon className="h-4 w-4" />
                                Retirer mon point
                            </button>
                        )}
                    </div>

                    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-xs text-white/80">
                        Clic : poser mon point GPS · Clic droit : le retirer · Molette : zoom
                    </div>
                </div>
            </AppWrapper>
        </AppContainer>
    );
};
