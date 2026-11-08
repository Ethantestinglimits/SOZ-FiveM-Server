import { FunctionComponent, useEffect, useRef } from 'react';

import { NuiEvent } from '../../../shared/event';
import { MinimapPoint } from '../../../shared/nui/minimap';
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
const PANEL_SIDE_VH = 4;
const PANEL_TOP_VH = 10.2;
const PANEL_BOTTOM_VH = 9.4;

export const MinimapApp: FunctionComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<MinimapRenderer | null>(null);
    const ratioRef = useRef(DEFAULT_RATIO);
    const scriptModeRef = useRef(false);
    const minimap = useHudMinimap();
    const style = useMinimapStyle();

    useEffect(() => {
        let contextPending = false;
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
                }
            },
            onDoubleClick: (point, hasWaypoint) =>
                fetchNui(hasWaypoint ? NuiEvent.MinimapRemoveWaypoint : NuiEvent.MinimapSetWaypoint, point),
            onRightClick: (point, screen) => {
                if (contextPending) {
                    return;
                }

                contextPending = true;
                setBlipAnchor(screen);
                renderer.setContextPoint(point);
                fetchNui<MinimapPoint, boolean>(NuiEvent.MinimapContextMenu, point)
                    .then((shown) => {
                        if (!shown) {
                            renderer.setContextPoint(null);
                        }
                    })
                    .finally(() => {
                        contextPending = false;
                    });
            },
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
            const toPx = (value: number) => (value * vh) / 100;

            if (scriptModeRef.current) {
                const margin = toPx(PANEL_MARGIN_VH);

                renderer.panelRect = { x: frame.x + margin, y: margin, w: frame.w - margin * 2, h: vh - margin * 2 };
            } else {
                const side = toPx(PANEL_SIDE_VH);
                const top = toPx(PANEL_TOP_VH);
                const bottom = toPx(PANEL_BOTTOM_VH);

                renderer.panelRect = { x: frame.x + side, y: top, w: frame.w - side * 2, h: vh - top - bottom };
            }
        };

        update();
        window.addEventListener('resize', update);

        return () => window.removeEventListener('resize', update);
    }, [minimap, style]);

    useNuiEvent('minimap', 'Frame', (frame) => rendererRef.current?.setFrame(frame));
    useNuiEvent('minimap', 'Style', setMinimapStyle);
    useNuiEvent('minimap', 'Blips', (blips) => rendererRef.current?.setBlips(blips));
    useNuiEvent('minimap', 'PlayerBlips', (moved) => rendererRef.current?.setPlayerBlips(moved));
    useNuiEvent('minimap', 'Zones', (zones) => rendererRef.current?.setZones(zones));
    useNuiEvent('minimap', 'Route', (route) => {
        if (rendererRef.current) rendererRef.current.route = route;
    });
    useNuiEvent('minimap', 'Markers', (markers) => {
        if (rendererRef.current) rendererRef.current.markers = markers;
    });
    useNuiEvent('minimap', 'Routes', (routes) => {
        if (rendererRef.current) rendererRef.current.extraRoutes = routes;
    });
    useNuiEvent('minimap', 'Waypoint', (waypoint) => {
        if (rendererRef.current) rendererRef.current.waypoint = waypoint;
    });
    useNuiEvent('minimap', 'Settings', ({ animation, fps, orientation, potato }) => {
        if (rendererRef.current) {
            rendererRef.current.potato = Boolean(potato);
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
