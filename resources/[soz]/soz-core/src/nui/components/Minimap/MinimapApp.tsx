import { FunctionComponent, useEffect, useRef } from 'react';

import { NuiEvent } from '../../../shared/event';
import { fetchNui } from '../../fetch';
import { useMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { MinimapRenderer } from './minimapRenderer';
import { minimapController } from './minimapState';

const DEFAULT_RATIO = 4 / 5.674;
const SCREEN_WIDTH_REFERENCE = 1920;
const SCREEN_HEIGHT_REFERENCE = 1080;
const OFFSET_X = 10 / SCREEN_WIDTH_REFERENCE;
const OFFSET_Y = 11 / SCREEN_HEIGHT_REFERENCE;
const OFFSET_WIDTH = -2 / SCREEN_WIDTH_REFERENCE;
const OFFSET_HEIGHT = -16 / SCREEN_HEIGHT_REFERENCE;
const PANEL_MARGIN_VH = 3;
const PANEL_COLUMN_VW = 17;
const PANEL_GAP_VH = 2;

export const MinimapApp: FunctionComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<MinimapRenderer | null>(null);
    const ratioRef = useRef(DEFAULT_RATIO);
    const minimap = useMinimap();

    useEffect(() => {
        const renderer = new MinimapRenderer(canvasRef.current, {
            onModeChange: mode => {
                if (mode === 'minimap') {
                    fetchNui(NuiEvent.PauseMenuClose);
                }
            },
            onClick: point => fetchNui(NuiEvent.MinimapSetWaypoint, point),
            onRightClick: () => fetchNui(NuiEvent.MinimapRemoveWaypoint),
        });

        rendererRef.current = renderer;
        minimapController.requestClose = () => renderer.requestClose();

        return () => {
            minimapController.requestClose = null;
            renderer.destroy();
        };
    }, []);

    useEffect(() => {
        const update = () => {
            const renderer = rendererRef.current;

            if (!renderer) {
                return;
            }

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const width = minimap.width * vw;

            if (!minimap.isHidden && minimap.height > 0) {
                ratioRef.current = (minimap.height * vh) / width;
            }

            const height = minimap.isHidden ? width * ratioRef.current : minimap.height * vh;

            renderer.minimapRect = {
                x: (minimap.left + OFFSET_X) * vw,
                y: minimap.bottom * vh - height + OFFSET_Y * vh,
                w: width + OFFSET_WIDTH * vw,
                h: height + OFFSET_HEIGHT * vh,
            };

            const margin = (PANEL_MARGIN_VH * vh) / 100;
            const x = margin + (PANEL_COLUMN_VW * vw) / 100 + (PANEL_GAP_VH * vh) / 100;

            renderer.panelRect = { x, y: margin, w: vw - x - margin, h: vh - margin * 2 };
        };

        update();
        window.addEventListener('resize', update);

        return () => window.removeEventListener('resize', update);
    }, [minimap]);

    useNuiEvent('minimap', 'Frame', frame => rendererRef.current?.setFrame(frame));
    useNuiEvent('minimap', 'Blips', blips => rendererRef.current?.setBlips(blips));
    useNuiEvent('minimap', 'Zones', zones => rendererRef.current?.setZones(zones));
    useNuiEvent('minimap', 'Route', route => {
        if (rendererRef.current) rendererRef.current.route = route;
    });
    useNuiEvent('minimap', 'Waypoint', waypoint => {
        if (rendererRef.current) rendererRef.current.waypoint = waypoint;
    });
    useNuiEvent('minimap', 'Settings', ({ animation }) => {
        if (rendererRef.current) rendererRef.current.transitionEnabled = animation;
    });
    useNuiEvent('pause_menu', 'Open', () => rendererRef.current?.open());
    useNuiEvent('pause_menu', 'Close', () => rendererRef.current?.reset());

    return <canvas ref={canvasRef} className="fixed shadow-lg" style={{ zIndex: 5, display: 'none' }} />;
};
