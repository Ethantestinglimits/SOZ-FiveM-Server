import { FunctionComponent, useEffect, useRef } from 'react';

import { NuiEvent } from '../../../shared/event';
import { fetchNui } from '../../fetch';
import { useHudMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { getScreenFrame, screenWidthToPx } from '../../utils/screenFrame';
import { MinimapRenderer } from './minimapRenderer';
import { isMapTabActive, minimapController, setBlipAnchor } from './minimapState';
import { setMinimapStyle, useMinimapStyle } from './minimapStyleState';

const DEFAULT_RATIO = 4 / 5.674;
const SCREEN_WIDTH_REFERENCE = 1920;
const SCREEN_HEIGHT_REFERENCE = 1080;
const OFFSET_X = 10 / SCREEN_WIDTH_REFERENCE;
const OFFSET_Y = 11 / SCREEN_HEIGHT_REFERENCE;
const OFFSET_WIDTH = -2 / SCREEN_WIDTH_REFERENCE;
const OFFSET_HEIGHT = -16 / SCREEN_HEIGHT_REFERENCE;
const PANEL_MARGIN_VH = 3;
const PANEL_COLUMN_VH = 30;
const PANEL_GAP_VH = 2;

export const MinimapApp: FunctionComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<MinimapRenderer | null>(null);
    const ratioRef = useRef(DEFAULT_RATIO);
    const scriptModeRef = useRef(false);
    const minimap = useHudMinimap();
    const style = useMinimapStyle();

    useEffect(() => {
        const renderer = new MinimapRenderer(canvasRef.current, {
            onModeChange: (mode) => {
                if (mode === 'minimap') {
                    fetchNui(NuiEvent.PauseMenuClose);
                }
            },
            onClick: (point, blip, screen) => {
                if (blip?.id && blip.actions) {
                    setBlipAnchor(screen ?? null);
                    fetchNui(NuiEvent.MinimapBlipClick, { id: blip.id });
                } else {
                    fetchNui(NuiEvent.MinimapSetWaypoint, point);
                }
            },
            onRightClick: () => fetchNui(NuiEvent.MinimapRemoveWaypoint),
        });

        rendererRef.current = renderer;
        minimapController.renderer = renderer;
        minimapController.requestClose = () => renderer.requestClose();
        minimapController.focus = (point, label) => renderer.focus(point, label);
        minimapController.setLayers = (layers) => {
            renderer.layers = layers;
        };

        return () => {
            minimapController.requestClose = null;
            minimapController.focus = null;
            minimapController.setLayers = null;
            minimapController.renderer = null;
            renderer.destroy();
        };
    }, []);

    useEffect(() => {
        const update = () => {
            const renderer = rendererRef.current;

            if (!renderer) {
                return;
            }

            const vh = window.innerHeight;
            const width = screenWidthToPx(minimap.width);

            if (!minimap.isHidden && minimap.height > 0) {
                ratioRef.current = (minimap.height * vh) / width;
            }

            const height = minimap.isHidden ? width * ratioRef.current : minimap.height * vh;

            const rect = {
                x: screenWidthToPx(minimap.left + OFFSET_X),
                y: minimap.bottom * vh - height + OFFSET_Y * vh,
                w: width + screenWidthToPx(OFFSET_WIDTH),
                h: height + OFFSET_HEIGHT * vh,
            };

            if (style.shape !== 'rectangle') {
                const side = Math.min(rect.w, rect.h);

                rect.y += rect.h - side;
                rect.w = side;
                rect.h = side;
            }

            renderer.style = style;
            renderer.minimapRect = rect;

            const frame = getScreenFrame();
            const margin = (PANEL_MARGIN_VH * vh) / 100;
            const x = scriptModeRef.current
                ? frame.x + margin
                : frame.x + margin + (PANEL_COLUMN_VH * vh) / 100 + (PANEL_GAP_VH * vh) / 100;

            renderer.panelRect = { x, y: margin, w: frame.x + frame.w - x - margin, h: vh - margin * 2 };
        };

        update();
        window.addEventListener('resize', update);

        return () => window.removeEventListener('resize', update);
    }, [minimap, style]);

    useNuiEvent('minimap', 'Frame', (frame) => rendererRef.current?.setFrame(frame));
    useNuiEvent('minimap', 'Style', setMinimapStyle);
    useNuiEvent('minimap', 'Blips', (blips) => rendererRef.current?.setBlips(blips));
    useNuiEvent('minimap', 'Zones', (zones) => rendererRef.current?.setZones(zones));
    useNuiEvent('minimap', 'Route', (route) => {
        if (rendererRef.current) rendererRef.current.route = route;
    });
    useNuiEvent('minimap', 'Waypoint', (waypoint) => {
        if (rendererRef.current) rendererRef.current.waypoint = waypoint;
    });
    useNuiEvent('minimap', 'Settings', ({ animation, fps, orientation }) => {
        if (rendererRef.current) {
            rendererRef.current.transitionEnabled = animation;
            rendererRef.current.fpsLimit = fps;
            rendererRef.current.orientation = orientation;
        }
    });
    useNuiEvent('pause_menu', 'Open', (data) => {
        scriptModeRef.current = Boolean(data.scriptMode);
        window.dispatchEvent(new Event('resize'));

        if (rendererRef.current) {
            rendererRef.current.layers = data.layers;
            rendererRef.current.setRegions(data.regions);
            rendererRef.current.open(Boolean(data.scriptMode) || !isMapTabActive(), data.focus);
        }
    });
    useNuiEvent('pause_menu', 'Close', () => rendererRef.current?.reset());

    return <canvas ref={canvasRef} className="fixed" style={{ zIndex: 5, display: 'none' }} />;
};
