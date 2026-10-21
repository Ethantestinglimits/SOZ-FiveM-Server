import {
    ArrowsExpandIcon,
    HashtagIcon,
    LocationMarkerIcon,
    TagIcon,
    TrashIcon,
    UserIcon,
} from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useEffect, useRef, useState } from 'react';

import { NuiEvent } from '../../../shared/event';
import {
    PauseMapBlip,
    PauseMapLayer,
    PauseMapPlayer,
    PauseMapPoint,
    PauseMapRegion,
    PauseMapSettings,
    PauseMapZone,
} from '../../../shared/nui/pause_menu';
import { fetchNui } from '../../fetch';
import { useNuiEvent } from '../../hook/nui';
import { PauseMapRenderer } from './pauseMapRenderer';

const MapLayers: { id: PauseMapLayer; label: string; icon: ReactNode }[] = [
    { id: 'blips', label: 'Points d’intérêt', icon: <LocationMarkerIcon /> },
    { id: 'regions', label: 'Noms des régions', icon: <TagIcon /> },
    { id: 'postals', label: 'Codes postaux', icon: <HashtagIcon /> },
];

type ToolbarButtonProps = {
    label: string;
    icon: ReactNode;
    active?: boolean;
    onClick: () => void;
};

const ToolbarButton: FunctionComponent<ToolbarButtonProps> = ({ label, icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={classNames(
            'group relative flex h-[4.2vh] w-[4.2vh] items-center justify-center rounded-[0.9vh] transition-colors duration-150',
            {
                'bg-white/90 text-black': active,
                'text-white/80 hover:bg-white/15 hover:text-white': !active,
            },
        )}
    >
        <span className="h-[2.2vh] w-[2.2vh]">{icon}</span>
        <span className="pointer-events-none absolute left-full ml-[1.4vh] whitespace-nowrap rounded-[0.6vh] bg-black/80 px-[1vh] py-[0.5vh] text-[1.4vh] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {label}
        </span>
    </button>
);

export type PauseMapFocus = PauseMapPoint & { id: number };

type PauseMapProps = {
    player: PauseMapPlayer;
    waypoint: PauseMapPoint | null;
    route: PauseMapPoint[];
    blips: PauseMapBlip[];
    zones: PauseMapZone[];
    regions: PauseMapRegion[];
    settings: PauseMapSettings;
    onSettingsChange: (settings: PauseMapSettings) => void;
    onOpenNativeMap: () => void;
    focusRequest: PauseMapFocus | null;
};

export const PauseMap: FunctionComponent<PauseMapProps> = ({
    player,
    waypoint,
    route,
    blips,
    zones,
    regions,
    settings,
    onSettingsChange,
    onOpenNativeMap,
    focusRequest,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PauseMapRenderer | null>(null);
    const [hover, setHover] = useState<{ x: number; y: number; name: string } | null>(null);
    const [hasWaypoint, setHasWaypoint] = useState(waypoint !== null);

    useEffect(() => {
        const renderer = new PauseMapRenderer(canvasRef.current, player, {
            onHover: setHover,
            onClick: (point) => fetchNui(NuiEvent.PauseMenuSetWaypoint, point),
            onRightClick: () => fetchNui(NuiEvent.PauseMenuRemoveWaypoint),
        });
        const observer = new ResizeObserver(([entry]) => {
            renderer.resize(entry.contentRect.width, entry.contentRect.height);
        });

        renderer.waypoint = waypoint;
        renderer.route = route ?? [];
        renderer.zones = zones ?? [];
        renderer.layers = settings?.layers ?? [];
        renderer.setBlips(blips);
        renderer.setRegions(regions);
        observer.observe(containerRef.current);
        rendererRef.current = renderer;

        return () => {
            observer.disconnect();
            renderer.destroy();
            rendererRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.layers = settings.layers;
            rendererRef.current.invalidate();
        }
    }, [settings.layers]);

    useEffect(() => {
        if (focusRequest && rendererRef.current) {
            rendererRef.current.focus(focusRequest, true);
        }
    }, [focusRequest?.id]);

    useNuiEvent('pause_menu', 'SetPlayer', (position) => {
        if (rendererRef.current) {
            rendererRef.current.player = position;
            rendererRef.current.invalidate();
        }
    });

    useNuiEvent('pause_menu', 'SetWaypoint', (position) => {
        setHasWaypoint(position !== null);

        if (rendererRef.current) {
            rendererRef.current.waypoint = position;
            rendererRef.current.invalidate();
        }
    });

    useNuiEvent('pause_menu', 'SetRoute', (points) => {
        if (rendererRef.current) {
            rendererRef.current.route = points ?? [];
            rendererRef.current.invalidate();
        }
    });

    const hasLayer = (layer: PauseMapLayer) => settings.layers.includes(layer);

    const toggleLayer = (layer: PauseMapLayer) => {
        onSettingsChange({
            layers: hasLayer(layer) ? settings.layers.filter((id) => id !== layer) : [...settings.layers, layer],
        });
    };

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-[1.2vh]">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

            {hover && (
                <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[0.6vh] border border-white/25 bg-black/75 px-[0.8vh] py-[0.4vh] text-[1.4vh] text-white"
                    style={{ left: hover.x, top: hover.y - 14 }}
                >
                    {hover.name}
                </div>
            )}

            <div className="absolute left-[1.5vh] top-[1.5vh] z-10 flex flex-col gap-[0.6vh] rounded-[1.2vh] border border-white/20 bg-black/60 p-[0.7vh]">
                {MapLayers.map((layer) => (
                    <ToolbarButton
                        key={layer.id}
                        label={layer.label}
                        icon={layer.icon}
                        active={hasLayer(layer.id)}
                        onClick={() => toggleLayer(layer.id)}
                    />
                ))}
                <div className="mx-[0.6vh] h-px bg-white/20" />
                <ToolbarButton
                    label="Me localiser"
                    icon={<UserIcon />}
                    onClick={() => rendererRef.current?.focus(rendererRef.current.player)}
                />
                {hasWaypoint && (
                    <ToolbarButton
                        label="Retirer le point GPS"
                        icon={<TrashIcon />}
                        onClick={() => fetchNui(NuiEvent.PauseMenuRemoveWaypoint)}
                    />
                )}
            </div>

            <button
                onClick={onOpenNativeMap}
                className="absolute right-[1.5vh] top-[1.5vh] z-10 flex items-center gap-[1vh] rounded-[1.2vh] border border-white/20 bg-black/60 px-[1.4vh] py-[0.9vh] text-[1.5vh] text-white transition-colors hover:bg-white/20"
            >
                <ArrowsExpandIcon className="h-[2vh] w-[2vh]" />
                Carte native
            </button>

            <div className="pointer-events-none absolute bottom-[1.5vh] left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-[1.6vh] py-[0.6vh] text-[1.3vh] text-white/80">
                Clic gauche : point GPS · Clic droit : le retirer · Molette : zoom
            </div>
        </div>
    );
};
