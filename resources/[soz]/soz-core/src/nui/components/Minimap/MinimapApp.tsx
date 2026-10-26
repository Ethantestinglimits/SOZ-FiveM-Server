import { FunctionComponent, useEffect, useRef } from 'react';

import { useMinimap } from '../../hook/data';
import { useNuiEvent } from '../../hook/nui';
import { MinimapRenderer } from './minimapRenderer';

const DEFAULT_RATIO = 4 / 5.674;
const SCREEN_WIDTH_REFERENCE = 1920;
const SCREEN_HEIGHT_REFERENCE = 1080;
const OFFSET_X = 10 / SCREEN_WIDTH_REFERENCE;
const OFFSET_Y = 11 / SCREEN_HEIGHT_REFERENCE;
const OFFSET_WIDTH = -2 / SCREEN_WIDTH_REFERENCE;
const OFFSET_HEIGHT = -16 / SCREEN_HEIGHT_REFERENCE;

export const MinimapApp: FunctionComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<MinimapRenderer | null>(null);
    const ratioRef = useRef(DEFAULT_RATIO);
    const minimap = useMinimap();

    useEffect(() => {
        const renderer = new MinimapRenderer(canvasRef.current);

        rendererRef.current = renderer;

        return () => renderer.destroy();
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

            renderer.rect = {
                x: (minimap.left + OFFSET_X) * vw,
                y: minimap.bottom * vh - height + OFFSET_Y * vh,
                w: width + OFFSET_WIDTH * vw,
                h: height + OFFSET_HEIGHT * vh,
            };
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

    return <canvas ref={canvasRef} className="fixed shadow-lg" style={{ zIndex: 5, display: 'none' }} />;
};
