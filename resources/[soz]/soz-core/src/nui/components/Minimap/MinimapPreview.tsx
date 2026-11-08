import { FunctionComponent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { screenWidthToPx } from '../../utils/screenFrame';
import { MinimapRenderer, ROUTE_COLOR } from './minimapRenderer';
import { minimapController } from './minimapState';
import { useMinimapStyle } from './minimapStyleState';

const DEFAULT_RATIO = 4 / 5.674;

export const MinimapPreview: FunctionComponent = () => {
    const placeholderRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<MinimapRenderer | null>(null);
    const minimap = useMinimap();
    const style = useMinimapStyle();

    const width = screenWidthToPx(minimap.width);
    const height = minimap.isHidden || minimap.height <= 0 ? width * DEFAULT_RATIO : minimap.height * window.innerHeight;
    const side = Math.min(width, height);
    const size = style.shape === 'rectangle' ? { width, height } : { width: side, height: side };

    useEffect(() => {
        const renderer = new MinimapRenderer(canvasRef.current, {
            onModeChange: () => undefined,
            onClick: () => undefined,
            onRightClick: () => undefined,
            onDoubleClick: () => undefined,
        });
        const main = minimapController.renderer;

        renderer.forceVisible = true;
        renderer.zIndex = '80';

        if (main) {
            const frame = main.getFrame();

            if (frame) {
                renderer.setFrame(frame);
            }

            renderer.setBlips(main.blips);
            renderer.setZones(main.zones);
            renderer.route = main.route;
            renderer.waypoint = main.waypoint;
            renderer.orientation = main.orientation;
            renderer.fpsLimit = main.fpsLimit;
        }

        rendererRef.current = renderer;

        return () => {
            rendererRef.current = null;
            renderer.destroy();
        };
    }, []);

    useEffect(() => {
        const update = () => {
            const renderer = rendererRef.current;
            const rect = placeholderRef.current?.getBoundingClientRect();

            if (!renderer || !rect) {
                return;
            }

            renderer.style = style;
            renderer.minimapRect = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
        };

        update();

        const observer = new ResizeObserver(update);

        observer.observe(placeholderRef.current);
        window.addEventListener('resize', update);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [style, size.width, size.height]);

    useNuiEvent('minimap', 'Frame', (frame) => rendererRef.current?.setFrame(frame));
    useNuiEvent('minimap', 'Blips', (blips) => rendererRef.current?.setBlips(blips));
    useNuiEvent('minimap', 'PlayerBlips', (moved) => rendererRef.current?.setPlayerBlips(moved));
    useNuiEvent('minimap', 'Zones', (zones) => rendererRef.current?.setZones(zones));
    useNuiEvent('minimap', 'Route', (route) => {
        if (rendererRef.current) rendererRef.current.route = route;
    });
    useNuiEvent('minimap', 'Waypoint', (waypoint) => {
        if (rendererRef.current) rendererRef.current.waypoint = waypoint;
    });
    useNuiEvent('minimap', 'WaypointColor', (color) => {
        if (rendererRef.current) rendererRef.current.routeColor = color ?? ROUTE_COLOR;
    });
    useNuiEvent('minimap', 'Settings', ({ fps, orientation }) => {
        if (rendererRef.current) {
            rendererRef.current.fpsLimit = fps;
            rendererRef.current.orientation = orientation;
        }
    });

    return (
        <>
            <div ref={placeholderRef} className="shrink-0" style={{ width: size.width, height: size.height }} />
            {createPortal(<canvas ref={canvasRef} className="fixed" style={{ display: 'none' }} />, document.body)}
        </>
    );
};
