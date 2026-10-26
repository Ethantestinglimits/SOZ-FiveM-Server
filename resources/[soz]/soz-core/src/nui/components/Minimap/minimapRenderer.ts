import { Postals } from '../../../config/postals';
import { MinimapBlip, MinimapFrame, MinimapPoint, MinimapZone } from '../../../shared/nui/minimap';
import { PauseMapLayer, PauseMapRegion } from '../../../shared/nui/pause_menu';
import { getBlipColor, UNTINTED_BLIP_COLORS } from './blipColors';
import { isMapTabActive, MinimapMode, setMinimapMode } from './minimapState';

const MAP_URL = 'https://cfx-nui-soz-map-tiles/map';
const BLIP_URL = 'https://cfx-nui-soz-map-tiles/blips';
const ASSETS_VERSION = 5;
const ORIGIN_X = -4140;
const ORIGIN_Y = 8400;
const IMAGE_UNITS = 4500;
const MIP_LEVELS = [1, 0.5, 0.25, 0.125];
export const getBlipIconUrl = (sprite: number): string => `${BLIP_URL}/${sprite}.webp?v=${ASSETS_VERSION}`;

const REGION_SCALE = [0.08, 1.6];
const POSTAL_MIN_SCALE = 0.8;
const FOCUS_SCALE = 1;
const FOCUS_RATE = 8;
const ICON_RESOLUTION = 64;
const BLIP_SIZE = 16;
const PANEL_BLIP_SIZE = 22;
const BASE_RANGE = 450;
const SPEED_RANGE = 9;
const ALTITUDE_RANGE = 2.5;
const MAX_RANGE = 2600;
const SEA_COLOR = '#4f86a8';
const MINIMAP_RADIUS = 12;
const PANEL_RADIUS = 16;
const PRESENCE_RATE = 10;
const RANGE_RATE = 2;
const SMOOTHING_RATE = 18;
const TRANSITION_MS = 450;
const ROUTE_COLOR = '#b25ce8';
const ROUTE_SEARCH_POINTS = 300;
const WAYPOINT_SPRITE = 8;
const WAYPOINT_SIZE = 22;
const PANEL_DEFAULT_SCALE = 0.6;
const PANEL_MIN_SCALE = 0.06;
const PANEL_MAX_SCALE = 8;
const ZOOM_FACTOR = 1.3;
const DRAG_THRESHOLD = 4;
const HOVER_RADIUS = 14;
const WRAP_MARGIN_X = 14000;
const WRAP_MARGIN_Y = 20000;
const WORLD_MIN_X = ORIGIN_X - WRAP_MARGIN_X / 2;
const WORLD_MIN_Y = -6600 - WRAP_MARGIN_Y / 2;
const WORLD_WIDTH = 10340 + WRAP_MARGIN_X;
const WORLD_HEIGHT = 15000 + WRAP_MARGIN_Y;
const WRAP_OFFSETS = [-1, 0, 1];

export type MinimapRect = { x: number; y: number; w: number; h: number };

type Camera = { x: number; y: number; scale: number; rotation: number };

type Label = { x: number; y: number; text: string; priority: number };

type MapImage = { x0: number; y0: number; x1: number; y1: number; levels: CanvasImageSource[]; widths: number[] };

export type MinimapCallbacks = {
    onModeChange: (mode: MinimapMode) => void;
    onClick: (point: MinimapPoint, blip?: MinimapBlip, screen?: { x: number; y: number }) => void;
    onRightClick: () => void;
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
    private readonly ctx: CanvasRenderingContext2D;
    private readonly images: MapImage[] = [];
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
    private routeIndex = 0;
    private lastAt = 0;
    private handle = 0;
    private destroyed = false;

    public minimapRect: MinimapRect = { x: 0, y: 0, w: 0, h: 0 };
    public panelRect: MinimapRect = { x: 0, y: 0, w: 0, h: 0 };
    public transitionEnabled = true;
    private instant = false;
    public blips: MinimapBlip[] = [];
    public zones: MinimapZone[] = [];
    public route: MinimapPoint[] = [];
    public waypoint: MinimapPoint | null = null;
    public layers: PauseMapLayer[] = ['blips', 'regions'];
    public highlight: MinimapPoint | null = null;
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

        this.loadMap();
        this.loadIcon(WAYPOINT_SPRITE);
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
            const { x, y, sprite } = this.hovered;

            this.hovered = blips.find((blip) => blip.x === x && blip.y === y && blip.sprite === sprite) ?? null;
        }

        for (const blip of blips) {
            this.loadIcon(blip.sprite);
        }
    }

    public setZones(zones: MinimapZone[]): void {
        this.zones = zones;
    }

    public setRegions(regions: PauseMapRegion[]): void {
        this.regionLabels = regions.map(region => ({
            x: region.x,
            y: region.y,
            text: region.name.toUpperCase(),
            priority: region.weight,
        }));
    }

    public focus(point: MinimapPoint): void {
        this.highlight = { ...point };
        this.target = {
            x: nearestCopy(point.x, this.panel.x, WORLD_WIDTH),
            y: nearestCopy(point.y, this.panel.y, WORLD_HEIGHT),
            scale: Math.max(this.panel.scale, FOCUS_SCALE),
        };
    }

    public open(instant = false): void {
        if (this.mode !== 'minimap' || !this.displayed) {
            return;
        }

        this.instant = instant;

        this.panel = { x: this.displayed.x, y: this.displayed.y, scale: PANEL_DEFAULT_SCALE };
        this.target = null;
        this.highlight = null;
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
        this.setMode('closing');

        return true;
    }

    public reset(): void {
        if (this.mode !== 'minimap') {
            this.hovered = null;
            this.drag = null;
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
            .then((image) => this.icons.set(sprite, image))
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

        const dt = this.lastAt ? Math.min(0.1, (now - this.lastAt) / 1000) : 0;

        this.lastAt = now;
        this.update(now, dt);
        this.render();
        this.handle = requestAnimationFrame(this.loop);
    };

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
            camHeading: lerpAngle(this.displayed.camHeading, this.frame.camHeading, k),
        };

        const frame = this.displayed;
        const live = this.frame.visible;
        const mapShown = this.mode !== 'open' || isMapTabActive();
        const wanted = this.mode === 'minimap' ? live : mapShown;

        this.range = lerp(
            this.range,
            Math.min(MAX_RANGE, BASE_RANGE + frame.speed * SPEED_RANGE + Math.max(0, frame.altitude) * ALTITUDE_RANGE),
            1 - Math.exp(-dt * RANGE_RATE),
        );
        this.presence = lerp(
            this.presence,
            wanted ? 1 : 0,
            1 - Math.exp(-dt * (this.transitionEnabled && !this.instant ? PRESENCE_RATE : 60)),
        );
        this.routeIndex = this.findRouteIndex(frame);

        if (live) {
            this.lockedRect = { ...this.minimapRect };
        }

        const base = live || !this.lockedRect ? this.minimapRect : this.lockedRect;
        const minimapCamera: Camera = {
            x: frame.x,
            y: frame.y,
            scale: base.w / this.range,
            rotation: toRadians(frame.camHeading),
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

    private getOffsets(): number[] {
        return this.mode === 'open' ? WRAP_OFFSETS : [0];
    }

    private toScreen(x: number, y: number, ox = 0, oy = 0): [number, number] {
        const { scale, rotation } = this.camera;
        const dx = (x + ox * WORLD_WIDTH - this.camera.x) * scale;
        const dy = (this.camera.y - y - oy * WORLD_HEIGHT) * scale;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        return [dx * cos - dy * sin + this.current.w / 2, dx * sin + dy * cos + this.current.h / 2];
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

        const dpr = window.devicePixelRatio || 1;
        const backing = this.mode === 'minimap' ? rect : this.panelRect;
        const width = Math.round(backing.w * dpr);
        const height = Math.round(backing.h * dpr);

        style.display = 'block';
        style.opacity = String(this.presence);
        style.left = `${rect.x}px`;
        style.top = `${rect.y}px`;
        style.width = `${rect.w}px`;
        style.height = `${rect.h}px`;
        style.zIndex = this.mode === 'minimap' ? '5' : '70';
        style.pointerEvents = this.mode === 'open' ? 'auto' : 'none';
        style.borderRadius = `${lerp(MINIMAP_RADIUS, PANEL_RADIUS, this.openness)}px`;
        style.boxShadow =
            this.mode === 'minimap' || this.mode === 'open' ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none';

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        const ctx = this.ctx;
        const offsets = this.getOffsets();

        const sx = width / rect.w;
        const sy = height / rect.h;

        ctx.setTransform(sx, 0, 0, sy, 0, 0);
        ctx.fillStyle = SEA_COLOR;
        ctx.fillRect(0, 0, rect.w, rect.h);

        this.drawMap(sx, offsets);

        const showBlips = this.mode === 'minimap' || this.layers.includes('blips');

        for (const ox of offsets) {
            for (const oy of offsets) {
                if (showBlips) {
                    this.drawZones(ox, oy);
                }

                this.drawRoute(frame, ox, oy);
            }
        }

        if (this.mode === 'open') {
            const zoom = this.camera.scale;

            for (const ox of offsets) {
                for (const oy of offsets) {
                    if (this.layers.includes('regions') && zoom >= REGION_SCALE[0] && zoom < REGION_SCALE[1]) {
                        const size = Math.min(20, Math.max(10, 10 + Math.log2(zoom / 0.1) * 3));

                        this.drawLabels(this.regionLabels, size, 'region', ox, oy);
                    }

                    if (this.layers.includes('postals') && zoom >= POSTAL_MIN_SCALE) {
                        const size = Math.min(14, 11 + Math.log2(zoom / POSTAL_MIN_SCALE) * 1.5);

                        this.drawLabels(this.postalLabels, size, 'postal', ox, oy);
                    }
                }
            }
        }

        for (const ox of offsets) {
            for (const oy of offsets) {
                if (showBlips) {
                    this.drawBlips(ox, oy);
                }

                this.drawWaypoint(ox, oy);
                this.drawHighlight(ox, oy);
                this.drawPlayer(frame, ox, oy);
            }
        }
    }

    private drawMap(dpr: number, offsets: number[]): void {
        const ctx = this.ctx;
        const { scale, rotation } = this.camera;
        const radius = Math.hypot(this.current.w, this.current.h) / 2;

        ctx.save();
        ctx.translate(this.current.w / 2, this.current.h / 2);
        ctx.rotate(rotation);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = this.mode === 'minimap' || this.mode === 'open' ? 'high' : 'medium';

        for (const ox of offsets) {
            for (const oy of offsets) {
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
        if (this.route.length < 2) {
            return;
        }

        const ctx = this.ctx;
        const [startX, startY] = this.toScreen(frame.x, frame.y, ox, oy);

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        for (let index = this.routeIndex + 1; index < this.route.length; index++) {
            const [x, y] = this.toScreen(this.route[index].x, this.route[index].y, ox, oy);

            ctx.lineTo(x, y);
        }

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = ROUTE_COLOR;
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
            const box: [number, number, number, number] = [x - width / 2, y - height / 2, x + width / 2, y + height / 2];

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

        const ctx = this.ctx;
        const [x, y] = this.toScreen(this.highlight.x, this.highlight.y, ox, oy);

        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    private drawBlips(ox: number, oy: number): void {
        const ctx = this.ctx;
        const baseSize = this.mode === 'minimap' ? BLIP_SIZE : PANEL_BLIP_SIZE;

        for (const blip of this.blips) {
            const highlighted = blip === this.hovered;
            const size = highlighted ? baseSize * 1.5 : baseSize;
            const [x, y] = this.toScreen(blip.x, blip.y, ox, oy);

            if (x < -size || y < -size || x > this.current.w + size || y > this.current.h + size) {
                continue;
            }

            if (highlighted) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
                ctx.fill();
            }

            const icon = this.getIcon(blip.sprite, blip.color);

            if (icon && blip.rotation) {
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
        }
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

        this.ctx.drawImage(icon, x - WAYPOINT_SIZE / 2, y - WAYPOINT_SIZE / 2, WAYPOINT_SIZE, WAYPOINT_SIZE);
    }

    private drawPlayer(frame: MinimapFrame, ox: number, oy: number): void {
        const ctx = this.ctx;
        const [x, y] = this.toScreen(frame.x, frame.y, ox, oy);

        if (x < -20 || y < -20 || x > this.current.w + 20 || y > this.current.h + 20) {
            return;
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.camera.rotation - toRadians(frame.heading));
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
        let bestDistance = HOVER_RADIUS;

        for (const blip of this.blips) {
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
                this.canvas.style.cursor = this.hovered ? 'pointer' : 'grab';
            }

            return;
        }

        const dx = event.clientX - this.drag.sx;
        const dy = event.clientY - this.drag.sy;

        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            this.drag.moved = true;
            this.hovered = null;
            this.target = null;
            this.highlight = null;
        }

        this.panel.x = wrap(this.drag.x - dx / this.panel.scale, WORLD_MIN_X, WORLD_WIDTH);
        this.panel.y = wrap(this.drag.y + dy / this.panel.scale, WORLD_MIN_Y, WORLD_HEIGHT);
    };

    private onPointerUp = (event: PointerEvent): void => {
        const drag = this.drag;

        this.drag = null;

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

    private onContextMenu = (event: MouseEvent): void => {
        event.preventDefault();

        if (this.mode === 'open') {
            this.callbacks.onRightClick();
        }
    };
}
