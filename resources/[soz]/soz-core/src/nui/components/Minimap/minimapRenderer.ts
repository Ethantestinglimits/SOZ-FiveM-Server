import { Postals } from '../../../config/postals';
import {
    MINIMAP_ARROW_DEFAULT,
    MINIMAP_TILT_DEFAULT,
    MINIMAP_ZOOM_DEFAULT,
    MinimapBlip,
    MinimapFrame,
    MinimapMarker,
    MinimapOrientation,
    MinimapPlayerBlip,
    MinimapPoint,
    MinimapRoute,
    MinimapZone,
} from '../../../shared/nui/minimap';
import { DEFAULT_MINIMAP_STYLE, MinimapStyle } from '../../../shared/nui/minimap';
import { PauseMapLayer, PauseMapRegion } from '../../../shared/nui/pause_menu';
import { getBlipColor, UNTINTED_BLIP_COLORS } from './blipColors';
import { isMapTabActive, isMinimapEditing, MinimapMode, setMinimapMode } from './minimapState';

const MAP_URL = 'https://cfx-nui-soz-map-tiles/map';
const BLIP_URL = 'https://cfx-nui-soz-map-tiles/blips';
const ASSETS_VERSION = 7;
const ORIGIN_X = -4140;
const ORIGIN_Y = 8400;
const IMAGE_UNITS = 4500;
const MIP_LEVELS = [1, 0.5, 0.25, 0.125];
export const getBlipIconUrl = (sprite: number): string => `${BLIP_URL}/${sprite}.webp?v=${ASSETS_VERSION}`;

const REGION_SCALE = [0.08, 1.6];
const POSTAL_MIN_SCALE = 0.8;
const PLAYER_LABEL_SCALE = 1.2;
const HIGHLIGHT_MS = 1600;
const HIGHLIGHT_FADE_FROM = 500;
const HIGHLIGHT_GROWTH = 0.9;
const HIGHLIGHT_PEAK = 0.2;
const FOCUS_SCALE = 1;
const SCRIPT_FOCUS_SCALE = 1.2;
const FOCUS_RATE = 8;
const ICON_RESOLUTION = 64;
const BLIP_SIZE = 16;
const PANEL_BLIP_SIZE = 22;
const BASE_RANGE = 450;
const SPEED_RANGE = 9;
const ALTITUDE_RANGE = 2.5;
const MAX_RANGE = 2600;
const SEA_COLOR = '#4f86a8';
export const MINIMAP_RADIUS = 12;
const PANEL_RADIUS = 16;
const PRESENCE_RATE = 10;
const RANGE_RATE = 2;
const SMOOTHING_RATE = 18;
const HEADING_SMOOTHING_RATE = 40;
const TRANSITION_MS = 250;
const ROUTE_COLOR = '#b25ce8';
const MARKER_RADIUS = 7;
const ROUTE_SEARCH_POINTS = 300;
const WAYPOINT_SPRITE = 8;
const WAYPOINT_SIZE = 22;
const WAYPOINT_SNAP = 2;
const PANEL_DEFAULT_SCALE = 0.6;
const PANEL_MIN_SCALE = 0.06;
const PANEL_MAX_SCALE = 8;
const ZOOM_FACTOR = 1.3;
const DRAG_THRESHOLD = 4;
const HOVER_RADIUS = 14;
const CONTEXT_POINT_RADIUS = 9;
const CONTEXT_POINT_GRACE = 300;
const GRABBING_CLASS = 'soz-pause-grabbing';
const BLIP_ZOOM_FROM = 1;
const BLIP_ZOOM_GROWTH = 0.4;
const BLIP_ZOOM_MAX = 2.2;
const WRAP_MARGIN_X = 14000;
const WRAP_MARGIN_Y = 20000;
const WORLD_MIN_X = ORIGIN_X - WRAP_MARGIN_X / 2;
const WORLD_MIN_Y = -6600 - WRAP_MARGIN_Y / 2;
const WORLD_WIDTH = 10340 + WRAP_MARGIN_X;
const WORLD_HEIGHT = 15000 + WRAP_MARGIN_Y;
const WRAP_OFFSETS = [-1, 0, 1];
const WRAP_MARGIN_PX = 120;
const IDLE_REFRESH_MS = 500;
const TILT_RATE = 6;
const HORIZON_MARGIN = 0.05;
const MINIMAP_PLAYER_ANCHOR = 0.8;
const MINIMAP_ZOOM = 0.85;
const TILT_PERSPECTIVE = 275;
const PLAYER_SPRITE = 6;

export type MinimapRect = { x: number; y: number; w: number; h: number };

type Camera = { x: number; y: number; scale: number; rotation: number };

type Label = { x: number; y: number; text: string; priority: number };

type MapImage = { x0: number; y0: number; x1: number; y1: number; levels: CanvasImageSource[]; widths: number[] };

const sharedImages: MapImage[] = [];
let mapRequested = false;

export type MinimapCallbacks = {
    onModeChange: (mode: MinimapMode) => void;
    onClick: (point: MinimapPoint, blip?: MinimapBlip, screen?: { x: number; y: number }) => void;
    onRightClick: (point: MinimapPoint, screen: { x: number; y: number }) => void;
    onDoubleClick: (point: MinimapPoint, hasWaypoint: boolean) => void;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const lerpAngle = (a: number, b: number, t: number) => {
    let delta = (b - a) % 360;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    return a + delta * t;
};

const lerpAngleRadians = (a: number, b: number, t: number) => {
    let delta = (b - a) % (Math.PI * 2);

    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    return a + delta * t;
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const wrap = (value: number, min: number, size: number) => ((((value - min) % size) + size) % size) + min;

const nearestCopy = (value: number, target: number, size: number) => value + Math.round((target - value) / size) * size;

const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load ${url}`));
        image.src = url;
    });

const downscale = (image: HTMLImageElement, ratio: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
};

export class MinimapRenderer {
    private ctx: CanvasRenderingContext2D;
    private ground: HTMLCanvasElement | null = null;
    private mapLayer: HTMLCanvasElement | null = null;
    private projection: { sin: number; cos: number; shift: number } | null = null;
    private dynamicTilt = 0;
    private readonly anchor = MINIMAP_PLAYER_ANCHOR;
    private readonly zoom = MINIMAP_ZOOM;
    private readonly perspective = TILT_PERSPECTIVE;
    private readonly images: MapImage[] = sharedImages;
    private readonly icons = new Map<number, HTMLImageElement | null>();
    private readonly tinted = new Map<string, HTMLCanvasElement>();

    private frame: MinimapFrame | null = null;
    private displayed: MinimapFrame | null = null;
    private mode: MinimapMode = 'minimap';
    private transitionStart = 0;
    private openness = 0;
    private range = BASE_RANGE;
    private presence = 0;
    private lockedRect: MinimapRect | null = null;
    private panel = { x: 0, y: 0, scale: PANEL_DEFAULT_SCALE };
    private camera: Camera = { x: 0, y: 0, scale: 1, rotation: 0 };
    private current: MinimapRect = { x: 0, y: 0, w: 0, h: 0 };
    private drag: { sx: number; sy: number; x: number; y: number; moved: boolean } | null = null;
    private hovered: MinimapBlip | null = null;
    private tooltip: { x: number; y: number; text: string } | null = null;
    private routeIndex = 0;
    private lastAt = 0;
    private handle = 0;
    private destroyed = false;

    public minimapRect: MinimapRect = { x: 0, y: 0, w: 0, h: 0 };
    public panelRect: MinimapRect = { x: 0, y: 0, w: 0, h: 0 };
    public transitionEnabled = true;
    public fpsLimit = 60;
    public orientation: MinimapOrientation = 'camera';
    public style: MinimapStyle = DEFAULT_MINIMAP_STYLE;
    public forceVisible = false;
    public zIndex: string | null = null;
    private lastRenderedAt = 0;
    private lastDrawnAt = 0;
    private version = 0;
    private renderKey = '';
    private renderRefs: unknown[] = [];
    private zoomCache = { scale: NaN, mode: '', value: 1 };
    public potato = false;
    private instant = false;
    public blips: MinimapBlip[] = [];
    public zones: MinimapZone[] = [];
    public route: MinimapPoint[] = [];
    public markers: MinimapMarker[] = [];
    public extraRoutes: MinimapRoute[] = [];
    public waypoint: MinimapPoint | null = null;
    public layers: PauseMapLayer[] = ['blips', 'regions', 'players'];
    public highlight: MinimapPoint | null = null;
    public contextPoint: MinimapPoint | null = null;
    private contextPointAt = 0;

    public setContextPoint(point: MinimapPoint | null): void {
        this.contextPoint = point;
        this.contextPointAt = performance.now();
    }

    public releaseContextPoint(): void {
        if (performance.now() - this.contextPointAt > CONTEXT_POINT_GRACE) {
            this.contextPoint = null;
        }
    }
    private highlightLabel: string | null = null;
    private highlightAt = 0;
    private highlightBlip: MinimapBlip | null = null;
    private target: { x: number; y: number; scale: number } | null = null;
    private regionLabels: Label[] = [];
    private readonly postalLabels: Label[] = Postals.map(([text, x, y]) => ({ text, x, y, priority: 0 }));

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly callbacks: MinimapCallbacks,
    ) {
        this.ctx = canvas.getContext('2d');

        canvas.addEventListener('wheel', this.onWheel, { passive: false });
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('contextmenu', this.onContextMenu);
        canvas.addEventListener('dblclick', this.onDoubleClick);

        this.loadMap();
        this.loadIcon(WAYPOINT_SPRITE);
        this.loadIcon(PLAYER_SPRITE);
        this.handle = requestAnimationFrame(this.loop);
    }

    public destroy(): void {
        this.destroyed = true;
        cancelAnimationFrame(this.handle);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        this.canvas.removeEventListener('pointermove', this.onPointerMove);
        this.canvas.removeEventListener('pointerup', this.onPointerUp);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        this.canvas.removeEventListener('dblclick', this.onDoubleClick);
    }

    public getFrame(): MinimapFrame | null {
        return this.frame;
    }

    public setFrame(frame: MinimapFrame): void {
        this.frame = frame;

        if (!this.displayed) {
            this.displayed = { ...frame };
        }
    }

    public setBlips(blips: MinimapBlip[]): void {
        this.blips = blips;

        if (this.hovered) {
            const { id, x, y, sprite } = this.hovered;

            if (this.highlightBlip) {
                const focused = this.highlightBlip;

                this.highlightBlip =
                    blips.find((blip) =>
                        focused.id ? blip.id === focused.id : blip.x === focused.x && blip.y === focused.y,
                    ) ?? null;
            }

            this.hovered =
                blips.find((blip) => (id ? blip.id === id : blip.x === x && blip.y === y && blip.sprite === sprite)) ??
                null;
        }

        for (const blip of blips) {
            this.loadIcon(blip.sprite);
        }
    }

    public setPlayerBlips(moved: MinimapPlayerBlip[]): void {
        const byId = new Map(moved.map((entry) => [entry.id, entry]));

        for (const blip of this.blips) {
            const entry = blip.player && byId.get(blip.id);

            if (entry) {
                blip.x = entry.x;
                blip.y = entry.y;
                blip.rotation = entry.rotation;
            }
        }

        this.version++;
    }

    public setZones(zones: MinimapZone[]): void {
        this.zones = zones;
    }

    public setRegions(regions: PauseMapRegion[]): void {
        this.version++;
        this.regionLabels = regions.map((region) => ({
            x: region.x,
            y: region.y,
            text: region.name.toUpperCase(),
            priority: region.weight,
        }));
    }

    public focus(point: MinimapPoint, label?: string): void {
        this.highlight = { ...point };
        this.highlightLabel = label ?? null;
        this.highlightAt = performance.now();
        this.highlightBlip =
            this.blips.find((blip) => this.isBlipVisible(blip) && Math.hypot(blip.x - point.x, blip.y - point.y) < 1) ??
            null;
        this.target = {
            x: nearestCopy(point.x, this.panel.x, WORLD_WIDTH),
            y: nearestCopy(point.y, this.panel.y, WORLD_HEIGHT),
            scale: Math.max(this.panel.scale, FOCUS_SCALE),
        };
    }

    public open(instant = false, center?: MinimapPoint): void {
        if (this.mode !== 'minimap' || !this.displayed) {
            return;
        }

        this.instant = instant;

        this.panel = {
            x: center?.x ?? this.displayed.x,
            y: center?.y ?? this.displayed.y,
            scale: center ? SCRIPT_FOCUS_SCALE : PANEL_DEFAULT_SCALE,
        };
        this.target = null;
        this.highlight = null;
        this.highlightLabel = null;
        this.setMode('opening');
    }

    public requestClose(): boolean {
        if (this.mode === 'closing') {
            return true;
        }

        if (this.mode !== 'open') {
            return false;
        }

        if (this.displayed) {
            this.panel.x = nearestCopy(this.panel.x, this.displayed.x, WORLD_WIDTH);
            this.panel.y = nearestCopy(this.panel.y, this.displayed.y, WORLD_HEIGHT);
        }

        this.hovered = null;
        this.target = null;
        this.highlight = null;
        this.highlightLabel = null;
        this.instant = this.instant || !isMapTabActive();
        this.setMode('closing');

        return true;
    }

    public reset(): void {
        if (this.mode !== 'minimap') {
            this.hovered = null;
            this.drag = null;
            this.contextPoint = null;
            document.documentElement.classList.remove(GRABBING_CLASS);
            this.openness = 0;
            this.setMode('minimap');
        }
    }

    private setMode(mode: MinimapMode): void {
        this.mode = mode;
        this.transitionStart = performance.now();
        setMinimapMode(mode);
        this.callbacks.onModeChange(mode);
    }

    private loadMap(): void {
        if (mapRequested) {
            return;
        }

        mapRequested = true;

        const sources = [
            ...[0, 1, 2].flatMap((row) =>
                [0, 1].map((col) => ({
                    url: `${MAP_URL}/${row}_${col}.webp?v=${ASSETS_VERSION}`,
                    x0: ORIGIN_X + col * IMAGE_UNITS,
                    y0: ORIGIN_Y - row * IMAGE_UNITS,
                    x1: ORIGIN_X + (col + 1) * IMAGE_UNITS,
                    y1: ORIGIN_Y - (row + 1) * IMAGE_UNITS,
                })),
            ),
            { url: `${MAP_URL}/cayo.webp?v=${ASSETS_VERSION}`, x0: 3726, y0: -4139, x1: 5733, y1: -6150 },
        ];

        for (const source of sources) {
            loadImage(source.url)
                .then((image) => {
                    const levels: CanvasImageSource[] = [image];
                    const widths = [image.naturalWidth];

                    for (const ratio of MIP_LEVELS.slice(1)) {
                        const level = downscale(image, ratio);

                        levels.push(level);
                        widths.push(level.width);
                    }

                    this.images.push({ ...source, levels, widths });
                    this.version++;
                })
                .catch((error) => console.error('[minimap]', error));
        }
    }

    private loadIcon(sprite: number): void {
        if (this.icons.has(sprite)) {
            return;
        }

        this.icons.set(sprite, null);
        loadImage(`${BLIP_URL}/${sprite}.webp?v=${ASSETS_VERSION}`)
            .then((image) => {
                this.icons.set(sprite, image);
                this.version++;
            })
            .catch(() => undefined);
    }

    private getIcon(sprite: number, color: number, tint?: string): CanvasImageSource | null {
        const image = this.icons.get(sprite);

        if (!image) {
            return null;
        }

        if (!tint && UNTINTED_BLIP_COLORS.includes(color)) {
            return image;
        }

        const key = `${sprite}-${color}`;
        const cached = this.tinted.get(key);

        if (cached) {
            return cached;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = ICON_RESOLUTION;
        canvas.height = ICON_RESOLUTION;
        ctx.drawImage(image, 0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = tint ?? getBlipColor(color);
        ctx.fillRect(0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(image, 0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
        this.tinted.set(key, canvas);

        return canvas;
    }

    private loop = (now: number): void => {
        if (this.destroyed) {
            return;
        }

        if (this.mode === 'minimap' && this.fpsLimit > 0 && now - this.lastRenderedAt < 1000 / this.fpsLimit - 2) {
            this.handle = requestAnimationFrame(this.loop);

            return;
        }

        this.lastRenderedAt = now;

        const dt = this.lastAt ? Math.min(0.1, (now - this.lastAt) / 1000) : 0;

        this.lastAt = now;
        this.update(now, dt);

        if (this.needsRender(now)) {
            this.lastDrawnAt = now;
            this.render();
        }

        this.handle = requestAnimationFrame(this.loop);
    };

    private needsRender(now: number): boolean {
        const camera = this.camera;
        const rect = this.current;
        const frame = this.displayed;
        const key = [
            this.mode,
            this.version,
            this.orientation,
            this.zIndex,
            isMinimapEditing(),
            rect.x.toFixed(1),
            rect.y.toFixed(1),
            rect.w.toFixed(1),
            rect.h.toFixed(1),
            camera.x.toFixed(2),
            camera.y.toFixed(2),
            camera.scale.toFixed(6),
            camera.rotation.toFixed(4),
            this.presence.toFixed(3),
            this.dynamicTilt.toFixed(2),
            this.perspective,
            this.openness.toFixed(3),
            frame ? `${frame.x.toFixed(2)}:${frame.y.toFixed(2)}:${frame.heading.toFixed(1)}` : '',
        ].join('|');
        const refs = [
            this.blips,
            this.zones,
            this.route,
            this.markers,
            this.extraRoutes,
            this.waypoint,
            this.layers,
            this.style,
            this.contextPoint,
            this.hovered,
            this.highlight,
            this.panelRect,
            this.minimapRect,
        ];
        const animating = this.highlight !== null && now - this.highlightAt < HIGHLIGHT_MS + 50;
        const changed =
            key !== this.renderKey || refs.some((ref, index) => ref !== this.renderRefs[index]) || animating;

        this.renderKey = key;
        this.renderRefs = refs;

        return changed || now - this.lastDrawnAt > IDLE_REFRESH_MS;
    }

    private update(now: number, dt: number): void {
        if (!this.frame || !this.displayed) {
            return;
        }

        const k = 1 - Math.exp(-dt * SMOOTHING_RATE);

        this.displayed = {
            ...this.frame,
            x: lerp(this.displayed.x, this.frame.x, k),
            y: lerp(this.displayed.y, this.frame.y, k),
            heading: lerpAngle(this.displayed.heading, this.frame.heading, k),
            camHeading: lerpAngle(
                this.displayed.camHeading,
                this.frame.camHeading,
                1 - Math.exp(-dt * HEADING_SMOOTHING_RATE),
            ),
        };

        const frame = this.displayed;
        const live = this.frame.visible || this.forceVisible;
        const hiddenByTab = !isMapTabActive() && (this.mode === 'open' || (this.mode === 'opening' && this.instant));
        const wanted = this.mode === 'minimap' ? live : !hiddenByTab;

        this.range = lerp(
            this.range,
            ((this.zoom * 100) / (this.style.zoom || MINIMAP_ZOOM_DEFAULT)) *
                Math.min(
                    MAX_RANGE,
                    BASE_RANGE + frame.speed * SPEED_RANGE + Math.max(0, frame.altitude) * ALTITUDE_RANGE,
                ),
            1 - Math.exp(-dt * RANGE_RATE),
        );
        this.presence = lerp(
            this.presence,
            wanted ? 1 : 0,
            1 - Math.exp(-dt * (this.transitionEnabled && !this.instant ? PRESENCE_RATE : 60)),
        );

        if (hiddenByTab) {
            this.presence = 0;
        }
        this.routeIndex = this.findRouteIndex(frame);

        const maxTilt = this.style.tilt ?? MINIMAP_TILT_DEFAULT;
        const targetTilt =
            this.style.tiltMode === 'camera'
                ? Math.min(maxTilt, Math.max(0, maxTilt + (this.frame.camPitch ?? 0)))
                : this.style.tiltMode === 'vehicle' && this.frame.inVehicle
                  ? maxTilt
                  : 0;

        this.dynamicTilt = lerp(this.dynamicTilt, targetTilt, 1 - Math.exp(-dt * TILT_RATE));

        if (live) {
            this.lockedRect = { ...this.minimapRect };
        }

        const base = live || !this.lockedRect ? this.minimapRect : this.lockedRect;
        const minimapScale = base.w / this.range;
        const minimapRotation = this.orientation === 'north' ? 0 : toRadians(frame.camHeading);
        const anchor = ((this.anchor - 0.5) * base.h) / (minimapScale || 1);
        const minimapCamera: Camera = {
            x: frame.x - anchor * Math.sin(minimapRotation),
            y: frame.y + anchor * Math.cos(minimapRotation),
            scale: minimapScale,
            rotation: minimapRotation,
        };

        let t = this.mode === 'open' ? 1 : 0;

        if (this.mode === 'opening' || this.mode === 'closing') {
            const duration = this.transitionEnabled && !this.instant ? TRANSITION_MS : 0;
            const progress = duration === 0 ? 1 : Math.min(1, (now - this.transitionStart) / duration);
            const eased = easeInOut(progress);

            t = this.mode === 'opening' ? eased : 1 - eased;

            if (progress >= 1) {
                this.setMode(this.mode === 'opening' ? 'open' : 'minimap');
            }
        }

        if (this.target && this.mode === 'open') {
            const follow = 1 - Math.exp(-dt * FOCUS_RATE);

            this.panel.x = lerp(this.panel.x, this.target.x, follow);
            this.panel.y = lerp(this.panel.y, this.target.y, follow);
            this.panel.scale = Math.exp(lerp(Math.log(this.panel.scale), Math.log(this.target.scale), follow));

            if (Math.hypot(this.target.x - this.panel.x, this.target.y - this.panel.y) < 1) {
                this.target = null;
            }
        }

        this.openness = t;
        this.current = {
            x: lerp(base.x, this.panelRect.x, t),
            y: lerp(base.y, this.panelRect.y, t),
            w: lerp(base.w, this.panelRect.w, t),
            h: lerp(base.h, this.panelRect.h, t),
        };
        this.camera = {
            x: lerp(minimapCamera.x, this.panel.x, t),
            y: lerp(minimapCamera.y, this.panel.y, t),
            scale: Math.exp(lerp(Math.log(minimapCamera.scale || 1), Math.log(this.panel.scale), t)),
            rotation: lerpAngleRadians(minimapCamera.rotation, 0, t),
        };
    }

    private findRouteIndex(frame: MinimapFrame): number {
        const limit = Math.min(this.route.length, ROUTE_SEARCH_POINTS);
        let best = 0;
        let bestDistance = Infinity;

        for (let index = 0; index < limit; index++) {
            const distance = Math.hypot(this.route[index].x - frame.x, this.route[index].y - frame.y);

            if (distance < bestDistance) {
                best = index;
                bestDistance = distance;
            }
        }

        return best;
    }

    private drawMapLayer(density: number, offsetsX: number[], offsetsY: number[]): void {
        if (!this.mapLayer) {
            this.mapLayer = document.createElement('canvas');
        }

        const layer = this.mapLayer;

        if (layer.width !== this.canvas.width || layer.height !== this.canvas.height) {
            layer.width = this.canvas.width;
            layer.height = this.canvas.height;
        }

        const main = this.ctx;
        const layerCtx = layer.getContext('2d');

        layerCtx.setTransform(1, 0, 0, 1, 0, 0);
        layerCtx.clearRect(0, 0, layer.width, layer.height);
        layerCtx.setTransform(density, 0, 0, layer.height / this.current.h, 0, 0);
        layerCtx.globalAlpha = 1;
        this.ctx = layerCtx;
        this.drawMap(density, offsetsX, offsetsY);
        this.ctx = main;

        main.save();
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.drawImage(layer, 0, 0);
        main.restore();
    }

    private drawGround(frame: MinimapFrame, offsetsX: number[], offsetsY: number[], showBlips: boolean): void {
        for (const ox of offsetsX) {
            for (const oy of offsetsY) {
                if (showBlips) {
                    this.drawZones(ox, oy);
                }

                this.drawRoute(frame, ox, oy);
            }
        }
    }

    private getAnchorOffset(): number {
        return (this.anchor - 0.5) * this.current.h * (1 - this.openness);
    }

    private getTilt(): number {
        const mode = this.style.tiltMode ?? 'vehicle';

        if (mode === 'none' || this.mode !== 'minimap' || this.current.h < 1) {
            return 0;
        }

        const base = mode === 'fixed' ? this.style.tilt ?? MINIMAP_TILT_DEFAULT : this.dynamicTilt;
        const requested = (base * (1 - this.openness) * Math.PI) / 180;

        if (Math.abs(requested) < 0.01) {
            return 0;
        }

        const limit = Math.atan((0.95 * this.perspective) / (this.current.h / 2 + Math.abs(this.getAnchorOffset())));

        return Math.max(-limit, Math.min(limit, requested));
    }

    private drawTiltedGround(
        frame: MinimapFrame,
        density: number,
        tilt: number,
        shift: number,
        offsetsX: number[],
        offsetsY: number[],
    ): void {
        const { w, h } = this.current;
        const p = this.perspective;
        const sin = Math.sin(tilt);
        const cos = Math.cos(tilt);
        const reach = h / 2 + Math.abs(shift);
        const top = (reach * p) / (p * cos - reach * sin);
        const topScale = p / (p + Math.abs(top) * Math.abs(sin));
        const sourceWidth = Math.ceil(w / topScale);
        const sourceHeight = Math.ceil(Math.abs(top) * 2);

        if (!this.ground) {
            this.ground = document.createElement('canvas');
        }

        const groundWidth = Math.round(sourceWidth * density);
        const groundHeight = Math.round(sourceHeight * density);

        if (this.ground.width !== groundWidth || this.ground.height !== groundHeight) {
            this.ground.width = groundWidth;
            this.ground.height = groundHeight;
        }

        const main = this.ctx;
        const current = this.current;
        const groundCtx = this.ground.getContext('2d');

        this.ctx = groundCtx;
        this.current = { x: 0, y: 0, w: sourceWidth, h: sourceHeight };

        groundCtx.setTransform(density, 0, 0, density, 0, 0);
        groundCtx.globalAlpha = 1;
        groundCtx.fillStyle = SEA_COLOR;
        groundCtx.fillRect(0, 0, sourceWidth, sourceHeight);
        this.drawMap(density, offsetsX, offsetsY);
        groundCtx.globalAlpha = 1;

        this.ctx = main;
        this.current = current;

        main.save();
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.imageSmoothingEnabled = true;

        const deviceWidth = this.canvas.width;
        const deviceHeight = this.canvas.height;

        for (let row = 0; row < deviceHeight; row++) {
            const destination = (row + 0.5) / density - h / 2 - shift;
            const y = (destination * p) / (p * cos + destination * sin);
            const scale = p / (p - y * sin);
            const sw = (w / scale) * density;
            const sx = groundWidth / 2 - sw / 2;
            const sy = Math.min(groundHeight - 1, Math.max(0, (sourceHeight / 2 + y) * density));

            main.drawImage(this.ground, sx, sy, sw, 1, 0, row, deviceWidth, 1);
        }

        main.restore();
    }

    private getOffsets(axis: 'x' | 'y'): number[] {
        if (this.mode !== 'open') {
            return [0];
        }

        const scale = this.camera.scale;

        return WRAP_OFFSETS.filter((offset) => {
            if (axis === 'x') {
                const from = (WORLD_MIN_X + offset * WORLD_WIDTH - this.camera.x) * scale + this.current.w / 2;

                return from < this.current.w + WRAP_MARGIN_PX && from + WORLD_WIDTH * scale > -WRAP_MARGIN_PX;
            }

            const top =
                (this.camera.y - WORLD_MIN_Y - offset * WORLD_HEIGHT - WORLD_HEIGHT) * scale + this.current.h / 2;

            return top < this.current.h + WRAP_MARGIN_PX && top + WORLD_HEIGHT * scale > -WRAP_MARGIN_PX;
        });
    }

    private toScreen(x: number, y: number, ox = 0, oy = 0): [number, number] {
        const { scale, rotation } = this.camera;
        const dx = (x + ox * WORLD_WIDTH - this.camera.x) * scale;
        const dy = (this.camera.y - y - oy * WORLD_HEIGHT) * scale;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const sx = dx * cos - dy * sin;
        const sy = dx * sin + dy * cos;

        if (!this.projection) {
            return [sx + this.current.w / 2, sy + this.current.h / 2];
        }

        const depth = this.perspective - sy * this.projection.sin;

        if (depth < this.perspective * HORIZON_MARGIN) {
            return [NaN, NaN];
        }

        const zoom = this.perspective / depth;

        return [
            this.current.w / 2 + sx * zoom,
            this.current.h / 2 + sy * this.projection.cos * zoom + this.projection.shift,
        ];
    }

    private toWorld(sx: number, sy: number): MinimapPoint {
        return {
            x: this.camera.x + (sx - this.current.w / 2) / this.camera.scale,
            y: this.camera.y - (sy - this.current.h / 2) / this.camera.scale,
        };
    }

    private render(): void {
        const style = this.canvas.style;
        const frame = this.displayed;
        const rect = this.current;

        if (!frame || this.presence < 0.02 || rect.w < 1 || rect.h < 1) {
            style.display = 'none';

            return;
        }

        const dpr = this.potato ? 1 : window.devicePixelRatio || 1;
        const backing = this.mode === 'minimap' ? rect : this.panelRect;
        const width = Math.round(backing.w * dpr);
        const height = Math.round(backing.h * dpr);

        style.display = 'block';
        style.opacity = String(this.presence);
        style.left = `${rect.x}px`;
        style.top = `${rect.y}px`;
        style.width = `${rect.w}px`;
        style.height = `${rect.h}px`;
        style.zIndex = this.zIndex ?? (isMinimapEditing() ? '210' : this.mode === 'minimap' ? '5' : '70');
        style.pointerEvents = this.mode === 'open' ? 'auto' : 'none';
        style.borderRadius = `${lerp(this.getMinimapRadius(), PANEL_RADIUS, this.openness)}px`;

        const shadow = this.mode === 'minimap' || this.mode === 'open' ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none';
        const border = this.style.borderWidth * (1 - this.openness);

        style.boxShadow =
            border > 0.05
                ? `0 0 0 ${border}px ${this.style.borderColor}${shadow === 'none' ? '' : `, ${shadow}`}`
                : shadow;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        const ctx = this.ctx;
        const offsetsX = this.getOffsets('x');
        const offsetsY = this.getOffsets('y');

        this.tooltip = null;

        const sx = width / rect.w;
        const sy = height / rect.h;

        ctx.setTransform(sx, 0, 0, sy, 0, 0);
        ctx.clearRect(0, 0, rect.w, rect.h);
        ctx.globalAlpha = lerp(this.style.opacity / 100, 1, this.openness);
        ctx.fillStyle = SEA_COLOR;
        ctx.fillRect(0, 0, rect.w, rect.h);

        const showBlips = this.mode === 'minimap' || this.layers.includes('blips');
        const showPlayers = this.mode === 'minimap' || this.layers.includes('players');
        const tilt = this.getTilt();

        if (tilt === 0) {
            if (this.mode === 'minimap' && ctx.globalAlpha < 0.999) {
                this.drawMapLayer(sx, offsetsX, offsetsY);
            } else {
                this.drawMap(sx, offsetsX, offsetsY);
            }

            ctx.globalAlpha = 1;
            this.drawGround(frame, offsetsX, offsetsY, showBlips);
        } else {
            const anchorOffset = this.getAnchorOffset();
            const tiltSin = Math.sin(tilt);
            const tiltCos = Math.cos(tilt);
            const shift =
                anchorOffset -
                (anchorOffset * tiltCos * this.perspective) / (this.perspective - anchorOffset * tiltSin);

            this.drawTiltedGround(frame, sx, tilt, shift, offsetsX, offsetsY);
            ctx.globalAlpha = 1;
            this.projection = { sin: tiltSin, cos: tiltCos, shift };
            this.drawGround(frame, offsetsX, offsetsY, showBlips);
        }

        for (const ox of offsetsX) {
            for (const oy of offsetsY) {
                this.drawBlips(ox, oy, showBlips, showPlayers);

                this.drawMarkers(ox, oy);
                this.drawWaypoint(ox, oy);
                this.drawContextPoint(ox, oy);
                this.drawHighlight(ox, oy);
                this.drawPlayer(frame, ox, oy);
            }
        }

        if (this.mode === 'open') {
            const zoom = this.camera.scale;

            for (const ox of offsetsX) {
                for (const oy of offsetsY) {
                    if (this.layers.includes('regions') && zoom >= REGION_SCALE[0] && zoom < REGION_SCALE[1]) {
                        const size = Math.min(20, Math.max(10, 10 + Math.log2(zoom / 0.1) * 3));

                        this.drawLabels(this.regionLabels, size, 'region', ox, oy);
                    }

                    if (showPlayers && zoom >= PLAYER_LABEL_SCALE) {
                        this.drawPlayerLabels(ox, oy);
                    }

                    if (this.layers.includes('postals') && zoom >= POSTAL_MIN_SCALE) {
                        const size = Math.min(14, 11 + Math.log2(zoom / POSTAL_MIN_SCALE) * 1.5);

                        this.drawLabels(this.postalLabels, size, 'postal', ox, oy);
                    }
                }
            }
        }

        this.drawTooltip();
        this.projection = null;
    }

    private isBlipVisible(blip: MinimapBlip): boolean {
        if (this.mode === 'minimap') {
            return true;
        }

        return this.layers.includes(blip.player ? 'players' : 'blips');
    }

    private getBlipLabel(blip: MinimapBlip): string {
        const name = blip.name ?? '';

        if (blip.player) {
            return name;
        }
        const same = this.blips.filter((other) => other.name === name);

        if (same.length < 2) {
            return name;
        }

        const origin = this.displayed ?? this.frame;
        const distance = (other: MinimapBlip) => (origin ? Math.hypot(other.x - origin.x, other.y - origin.y) : 0);

        same.sort((a, b) => distance(a) - distance(b));

        return `${name} ${same.indexOf(blip) + 1}/${same.length}`;
    }

    private drawTooltip(): void {
        if (!this.tooltip) {
            return;
        }

        const ctx = this.ctx;
        const { x, y, text } = this.tooltip;

        ctx.save();
        ctx.font = '600 13px Prompt, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const width = ctx.measureText(text).width + 16;
        const height = 24;
        const left = Math.min(this.current.w - width - 4, Math.max(4, x - width / 2));
        const top = Math.max(4, y - height - 6);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.beginPath();
        ctx.roundRect(left, top, width, height, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, left + width / 2, top + height / 2 + 1);
        ctx.restore();
    }

    private getMinimapRadius(): number {
        const side = Math.min(this.minimapRect.w, this.minimapRect.h);

        if (this.style.shape === 'circle') {
            return side / 2;
        }

        return this.style.radius === undefined ? MINIMAP_RADIUS : (side * this.style.radius) / 100;
    }

    private drawMap(dpr: number, offsetsX: number[], offsetsY: number[]): void {
        const ctx = this.ctx;
        const { scale, rotation } = this.camera;
        const radius = Math.hypot(this.current.w, this.current.h) / 2;

        ctx.save();
        ctx.translate(this.current.w / 2, this.current.h / 2);
        ctx.rotate(rotation);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality =
            !this.potato && (this.mode === 'minimap' || this.mode === 'open') ? 'high' : this.potato ? 'low' : 'medium';

        for (const ox of offsetsX) {
            for (const oy of offsetsY) {
                for (const image of this.images) {
                    const x = (image.x0 + ox * WORLD_WIDTH - this.camera.x) * scale;
                    const y = (this.camera.y - image.y0 - oy * WORLD_HEIGHT) * scale;
                    const w = (image.x1 - image.x0) * scale;
                    const h = (image.y0 - image.y1) * scale;

                    if (x > radius || y > radius || x + w < -radius || y + h < -radius) {
                        continue;
                    }

                    let level = 0;

                    while (level < image.levels.length - 1 && image.widths[level + 1] >= w * dpr) {
                        level++;
                    }

                    ctx.drawImage(image.levels[level], x - 1, y - 1, w + 2, h + 2);
                }
            }
        }

        ctx.restore();
    }

    private drawZones(ox: number, oy: number): void {
        const ctx = this.ctx;

        for (const zone of this.zones) {
            const [x, y] = this.toScreen(zone.x, zone.y, ox, oy);
            const radius = zone.radius * this.camera.scale;

            if (x + radius < 0 || y + radius < 0 || x - radius > this.current.w || y - radius > this.current.h) {
                continue;
            }

            const color = getBlipColor(zone.color);

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.globalAlpha = Math.min(0.5, zone.alpha / 255);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
            ctx.strokeStyle = color;
            ctx.stroke();
        }
    }

    private drawRoute(frame: MinimapFrame, ox: number, oy: number): void {
        for (const route of this.extraRoutes) {
            this.drawPath(route.points, 0, route.color, ox, oy);
        }

        this.drawPath(this.route, this.routeIndex, ROUTE_COLOR, ox, oy);
    }

    private drawMarkers(ox: number, oy: number): void {
        const ctx = this.ctx;

        for (const marker of this.markers) {
            const [x, y] = this.toScreen(marker.x, marker.y, ox, oy);

            if (!Number.isFinite(x) || x < -20 || y < -20 || x > this.current.w + 20 || y > this.current.h + 20) {
                continue;
            }

            ctx.beginPath();
            ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2);
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.stroke();
            ctx.fillStyle = marker.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            if (marker.label && this.mode === 'open') {
                ctx.font = '600 12px Prompt, sans-serif';
                ctx.textAlign = 'center';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.strokeText(marker.label, x, y - MARKER_RADIUS - 6);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(marker.label, x, y - MARKER_RADIUS - 6);
            }
        }
    }

    private drawPath(points: MinimapPoint[], from: number, color: string, ox: number, oy: number): void {
        if (points.length - from < 2) {
            return;
        }

        const ctx = this.ctx;
        let started = false;
        let previousX = 0;
        let previousY = 0;

        ctx.beginPath();

        for (let index = from; index < points.length; index++) {
            const [x, y] = this.toScreen(points[index].x, points[index].y, ox, oy);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                if (started) {
                    ctx.lineTo(previousX, previousY);
                }

                started = false;
                continue;
            }

            if (started) {
                ctx.quadraticCurveTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2);
            } else {
                ctx.moveTo(x, y);
                started = true;
            }

            previousX = x;
            previousY = y;
        }

        if (started) {
            ctx.lineTo(previousX, previousY);
        }

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    private drawLabels(labels: Label[], size: number, kind: 'region' | 'postal', ox: number, oy: number): void {
        const ctx = this.ctx;
        const padding = kind === 'postal' ? 4 : 3;
        const boxes: [number, number, number, number][] = [];
        const sorted = kind === 'region' ? [...labels].sort((a, b) => b.priority - a.priority) : labels;

        ctx.font = `${kind === 'region' ? 700 : 600} ${size}px Prompt, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const label of sorted) {
            const [x, y] = this.toScreen(label.x, label.y, ox, oy);

            if (x < -100 || y < -50 || x > this.current.w + 100 || y > this.current.h + 50) {
                continue;
            }

            const width = ctx.measureText(label.text).width + padding * 2;
            const height = size + padding * 2;
            const box: [number, number, number, number] = [
                x - width / 2,
                y - height / 2,
                x + width / 2,
                y + height / 2,
            ];

            if (boxes.some(([bx0, by0, bx1, by1]) => box[0] < bx1 && box[2] > bx0 && box[1] < by1 && box[3] > by0)) {
                continue;
            }

            boxes.push(box);

            if (kind === 'postal') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(box[0], box[1], width, height);
                ctx.fillStyle = '#fde68a';
                ctx.fillText(label.text, x, y + 1);
            } else {
                ctx.lineJoin = 'round';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.strokeText(label.text, x, y);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label.text, x, y);
            }
        }
    }

    private drawHighlight(ox: number, oy: number): void {
        if (!this.highlight || this.mode !== 'open') {
            return;
        }

        const age = performance.now() - this.highlightAt;

        if (age > HIGHLIGHT_MS) {
            this.highlight = null;
            this.highlightLabel = null;
            this.highlightBlip = null;

            return;
        }

        if (this.highlightBlip) {
            return;
        }

        const ctx = this.ctx;
        const [x, y] = this.toScreen(this.highlight.x, this.highlight.y, ox, oy);

        ctx.save();
        ctx.globalAlpha = 1 - Math.max(0, (age - HIGHLIGHT_FADE_FROM) / (HIGHLIGHT_MS - HIGHLIGHT_FADE_FROM));
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.lineWidth = 7;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.stroke();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = ROUTE_COLOR;
        ctx.stroke();
        ctx.restore();

        if (this.highlightLabel && !this.tooltip) {
            this.tooltip = { x, y: y - 24, text: this.highlightLabel };
        }
    }

    private getBlipZoom(): number {
        const cache = this.zoomCache;

        if (cache.scale === this.camera.scale && cache.mode === this.mode) {
            return cache.value;
        }

        cache.scale = this.camera.scale;
        cache.mode = this.mode;
        cache.value =
            this.mode === 'minimap' || this.camera.scale <= BLIP_ZOOM_FROM
                ? 1
                : Math.min(BLIP_ZOOM_MAX, 1 + Math.log2(this.camera.scale / BLIP_ZOOM_FROM) * BLIP_ZOOM_GROWTH);

        return cache.value;
    }

    private getFocusGrowth(): number {
        const progress = Math.min(1, (performance.now() - this.highlightAt) / HIGHLIGHT_MS);
        const bump =
            progress < HIGHLIGHT_PEAK
                ? progress / HIGHLIGHT_PEAK
                : 1 - (progress - HIGHLIGHT_PEAK) / (1 - HIGHLIGHT_PEAK);

        return 1 + HIGHLIGHT_GROWTH * Math.sin((bump * Math.PI) / 2);
    }

    private drawBlips(ox: number, oy: number, showBlips: boolean, showPlayers: boolean): void {
        const ctx = this.ctx;
        const baseSize = this.mode === 'minimap' ? BLIP_SIZE : PANEL_BLIP_SIZE * this.getBlipZoom();

        for (const blip of this.blips) {
            if (!(blip.player ? showPlayers : showBlips)) {
                continue;
            }

            const focused = blip === this.highlightBlip && this.highlight !== null && this.mode === 'open';
            const highlighted = blip === this.hovered || focused;
            const size = focused ? baseSize * this.getFocusGrowth() : blip === this.hovered ? baseSize * 1.5 : baseSize;
            const [x, y] = this.toScreen(blip.x, blip.y, ox, oy);

            if (x < -size || y < -size || x > this.current.w + size || y > this.current.h + size) {
                continue;
            }

            if (focused && this.highlightLabel) {
                this.tooltip = { x, y: y - size, text: this.highlightLabel };
            } else if (highlighted && this.mode === 'open' && blip.name) {
                this.tooltip = { x, y: y - size, text: this.getBlipLabel(blip) };
            }

            if (highlighted) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
                ctx.fill();
            }

            const icon = this.getIcon(blip.sprite, blip.color);

            ctx.globalAlpha = highlighted ? 1 : (blip.alpha ?? 255) / 255;

            if (blip.player) {
                this.drawPlayerBlip(blip, icon, x, y, size);
            } else if (icon && blip.rotation && this.orientation !== 'upright') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(this.camera.rotation - toRadians(blip.rotation));
                ctx.drawImage(icon, -size / 2, -size / 2, size, size);
                ctx.restore();
            } else if (icon) {
                ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
            } else {
                ctx.fillStyle = getBlipColor(blip.color);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;
        }
    }

    private drawPlayerBlip(
        blip: MinimapBlip,
        icon: CanvasImageSource | null,
        x: number,
        y: number,
        size: number,
    ): void {
        const ctx = this.ctx;
        const iconSize = size * 0.8;

        if (icon) {
            ctx.drawImage(icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        } else {
            ctx.fillStyle = getBlipColor(blip.color);
            ctx.beginPath();
            ctx.arc(x, y, iconSize / 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.camera.rotation - toRadians(blip.rotation));
        ctx.beginPath();
        ctx.moveTo(0, -iconSize * 0.75);
        ctx.lineTo(iconSize * 0.22, -iconSize * 0.45);
        ctx.lineTo(-iconSize * 0.22, -iconSize * 0.45);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }

    private drawPlayerLabels(ox: number, oy: number): void {
        const ctx = this.ctx;
        const boxes: [number, number, number, number][] = [];

        ctx.font = '600 11px Prompt, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;

        for (const blip of this.blips) {
            if (!blip.player || !blip.name || blip === this.hovered) {
                continue;
            }

            const [x, y] = this.toScreen(blip.x, blip.y, ox, oy);
            const top = y + PANEL_BLIP_SIZE * this.getBlipZoom() * 0.5;

            if (x < -100 || top < -20 || x > this.current.w + 100 || top > this.current.h + 20) {
                continue;
            }

            const width = ctx.measureText(blip.name).width + 4;
            const box: [number, number, number, number] = [x - width / 2, top, x + width / 2, top + 14];

            if (boxes.some(([bx0, by0, bx1, by1]) => box[0] < bx1 && box[2] > bx0 && box[1] < by1 && box[3] > by0)) {
                continue;
            }

            boxes.push(box);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.strokeText(blip.name, x, top);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(blip.name, x, top);
        }
    }

    private drawContextPoint(ox: number, oy: number): void {
        if (!this.contextPoint || this.mode !== 'open') {
            return;
        }

        const ctx = this.ctx;
        const [x, y] = this.toScreen(this.contextPoint.x, this.contextPoint.y, ox, oy);

        ctx.beginPath();
        ctx.arc(x, y, CONTEXT_POINT_RADIUS, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    private drawWaypoint(ox: number, oy: number): void {
        if (!this.waypoint) {
            return;
        }

        const icon = this.getIcon(WAYPOINT_SPRITE, 84, ROUTE_COLOR);

        if (!icon) {
            return;
        }

        const [x, y] = this.toScreen(this.waypoint.x, this.waypoint.y, ox, oy);
        const hovered =
            this.hovered &&
            Math.hypot(this.hovered.x - this.waypoint.x, this.hovered.y - this.waypoint.y) < WAYPOINT_SNAP;
        const base = this.mode === 'minimap' ? WAYPOINT_SIZE : WAYPOINT_SIZE * this.getBlipZoom();
        const size = hovered ? base * 1.5 : base;

        this.ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
    }

    private drawPlayer(frame: MinimapFrame, ox: number, oy: number): void {
        const ctx = this.ctx;
        const [x, y] = this.toScreen(frame.x, frame.y, ox, oy);

        if (x < -20 || y < -20 || x > this.current.w + 20 || y > this.current.h + 20) {
            return;
        }

        ctx.save();
        ctx.translate(x, y);

        if (this.projection && this.style.tiltArrow) {
            ctx.scale(1, this.projection.cos);
        }

        ctx.rotate(this.camera.rotation - toRadians(frame.heading));

        const icon = this.icons.get(PLAYER_SPRITE);

        if (icon) {
            const size = this.style.arrowSize ?? MINIMAP_ARROW_DEFAULT;

            ctx.drawImage(icon, -size / 2, -size / 2, size, size);
            ctx.restore();

            return;
        }

        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 8);
        ctx.lineTo(0, 4);
        ctx.lineTo(-7, 8);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    private findBlipAt(sx: number, sy: number): MinimapBlip | null {
        let best: MinimapBlip | null = null;
        let bestDistance = HOVER_RADIUS * this.getBlipZoom();

        for (const blip of this.blips) {
            if (!this.isBlipVisible(blip)) {
                continue;
            }

            for (const ox of WRAP_OFFSETS) {
                for (const oy of WRAP_OFFSETS) {
                    const [x, y] = this.toScreen(blip.x, blip.y, ox, oy);
                    const distance = Math.hypot(x - sx, y - sy);

                    if (distance < bestDistance) {
                        best = blip;
                        bestDistance = distance;
                    }
                }
            }
        }

        return best;
    }

    private onWheel = (event: WheelEvent): void => {
        if (this.mode !== 'open') {
            return;
        }

        event.preventDefault();

        const bounds = this.canvas.getBoundingClientRect();
        const sx = event.clientX - bounds.left;
        const sy = event.clientY - bounds.top;
        const before = this.toWorld(sx, sy);
        const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

        this.panel.scale = Math.min(PANEL_MAX_SCALE, Math.max(PANEL_MIN_SCALE, this.panel.scale * factor));
        this.camera.scale = this.panel.scale;

        const after = this.toWorld(sx, sy);

        this.panel.x = wrap(this.panel.x + before.x - after.x, WORLD_MIN_X, WORLD_WIDTH);
        this.panel.y = wrap(this.panel.y + before.y - after.y, WORLD_MIN_Y, WORLD_HEIGHT);
    };

    private onPointerDown = (event: PointerEvent): void => {
        if (this.mode !== 'open' || event.button !== 0) {
            return;
        }

        this.canvas.setPointerCapture(event.pointerId);
        this.drag = { sx: event.clientX, sy: event.clientY, x: this.panel.x, y: this.panel.y, moved: false };
    };

    private onPointerMove = (event: PointerEvent): void => {
        if (!this.drag) {
            if (this.mode === 'open') {
                const bounds = this.canvas.getBoundingClientRect();

                this.hovered = this.findBlipAt(event.clientX - bounds.left, event.clientY - bounds.top);
            }

            return;
        }

        const dx = event.clientX - this.drag.sx;
        const dy = event.clientY - this.drag.sy;

        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            if (!this.drag.moved) {
                document.documentElement.classList.add(GRABBING_CLASS);
            }

            this.drag.moved = true;
            this.hovered = null;
            this.target = null;
            this.highlight = null;
            this.highlightLabel = null;
        }

        this.panel.x = wrap(this.drag.x - dx / this.panel.scale, WORLD_MIN_X, WORLD_WIDTH);
        this.panel.y = wrap(this.drag.y + dy / this.panel.scale, WORLD_MIN_Y, WORLD_HEIGHT);
    };

    private onPointerUp = (event: PointerEvent): void => {
        const drag = this.drag;

        this.drag = null;
        document.documentElement.classList.remove(GRABBING_CLASS);

        if (!drag || drag.moved || this.mode !== 'open') {
            return;
        }

        const bounds = this.canvas.getBoundingClientRect();
        const sx = event.clientX - bounds.left;
        const sy = event.clientY - bounds.top;
        const blip = this.findBlipAt(sx, sy);

        if (blip) {
            this.callbacks.onClick({ x: blip.x, y: blip.y }, blip, { x: event.clientX, y: event.clientY });

            return;
        }

        const point = this.toWorld(sx, sy);

        this.callbacks.onClick({
            x: wrap(point.x, WORLD_MIN_X, WORLD_WIDTH),
            y: wrap(point.y, WORLD_MIN_Y, WORLD_HEIGHT),
        });
    };

    private onDoubleClick = (event: MouseEvent): void => {
        event.preventDefault();

        if (this.mode !== 'open') {
            return;
        }

        const bounds = this.canvas.getBoundingClientRect();
        const sx = event.clientX - bounds.left;
        const sy = event.clientY - bounds.top;
        const blip = this.findBlipAt(sx, sy);
        const point = blip ? { x: blip.x, y: blip.y } : this.toWorld(sx, sy);
        const hasWaypoint = Boolean(this.waypoint);

        this.callbacks.onDoubleClick(
            { x: wrap(point.x, WORLD_MIN_X, WORLD_WIDTH), y: wrap(point.y, WORLD_MIN_Y, WORLD_HEIGHT) },
            hasWaypoint,
        );
    };

    private onContextMenu = (event: MouseEvent): void => {
        event.preventDefault();

        if (this.mode !== 'open') {
            return;
        }

        const bounds = this.canvas.getBoundingClientRect();
        const point = this.toWorld(event.clientX - bounds.left, event.clientY - bounds.top);

        this.callbacks.onRightClick(
            { x: wrap(point.x, WORLD_MIN_X, WORLD_WIDTH), y: wrap(point.y, WORLD_MIN_Y, WORLD_HEIGHT) },
            { x: event.clientX, y: event.clientY },
        );
    };
}
