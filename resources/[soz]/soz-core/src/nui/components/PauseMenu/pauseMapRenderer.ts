import { Postals } from '../../../config/postals';
import {
    PauseMapBlip,
    PauseMapLayer,
    PauseMapPlayer,
    PauseMapPoint,
    PauseMapRegion,
    PauseMapZone,
} from '../../../shared/nui/pause_menu';
import { getBlipColor, UNTINTED_BLIP_COLORS } from './blipColors';

const MAP_URL = 'https://cfx-nui-soz-map-tiles/map';
const BLIP_URL = 'https://cfx-nui-soz-map-tiles/blips';
const ASSETS_VERSION = 5;
const ORIGIN_X = -4140;
const ORIGIN_Y = 8400;
const IMAGE_UNITS = 4500;
const MIN_X = ORIGIN_X;
const MAX_X = 6200;
const MIN_Y = -6600;
const MAX_Y = ORIGIN_Y;
const MIN_SCALE_MARGIN = 0.9;
const MAX_SCALE = 8;
const DEFAULT_SCALE = 0.4;
const ZOOM_FACTOR = 1.35;
const ANIMATION_SPEED = 0.22;
const BLIP_SIZE = 24;
const ICON_RESOLUTION = 64;
const HOVER_RADIUS = 14;
const DRAG_THRESHOLD = 4;
const BOTTOM_BLIP_SPRITES = [278];
const REGION_SCALE = [0.08, 1.6];
const POSTAL_MIN_SCALE = 0.8;
const MIP_LEVELS = [1, 0.5, 0.25, 0.125];

type MapImageSource = { url: string; x0: number; y0: number; x1: number; y1: number };

type MapImage = MapImageSource & { levels: CanvasImageSource[]; widths: number[] };

export const getBlipIconUrl = (sprite: number): string => `${BLIP_URL}/${sprite}.webp?v=${ASSETS_VERSION}`;

const MapImageSources: MapImageSource[] = [
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

const mapImages = new Map<string, MapImage>();
const failedMapImages = new Set<string>();
const loadingMapImages = new Set<string>();
const mapImageListeners = new Set<() => void>();

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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
};

const loadMapImage = async (source: MapImageSource): Promise<void> => {
    loadingMapImages.add(source.url);

    try {
        const image = await loadImage(source.url);
        const levels: CanvasImageSource[] = [image];
        const widths: number[] = [image.naturalWidth];

        for (const ratio of MIP_LEVELS.slice(1)) {
            const level = downscale(image, ratio);

            levels.push(level);
            widths.push(level.width);
        }

        mapImages.set(source.url, { ...source, levels, widths });
        failedMapImages.delete(source.url);
    } catch (error) {
        failedMapImages.add(source.url);
        console.error('[pause-map]', error);
    } finally {
        loadingMapImages.delete(source.url);
        mapImageListeners.forEach((listener) => listener());
    }
};

export const preloadPauseMap = (): void => {
    for (const source of MapImageSources) {
        if (!mapImages.has(source.url) && !loadingMapImages.has(source.url)) {
            loadMapImage(source);
        }
    }
};

const iconImages = new Map<number, HTMLImageElement | null>();
const tintedIcons = new Map<string, HTMLCanvasElement | null>();

type Label = { x: number; y: number; text: string; priority: number };

export type PauseMapRendererCallbacks = {
    onHover: (hover: { x: number; y: number; name: string } | null) => void;
    onClick: (point: PauseMapPoint) => void;
    onRightClick: () => void;
};

export class PauseMapRenderer {
    private readonly ctx: CanvasRenderingContext2D;
    private width = 0;
    private height = 0;
    private dpr = 1;

    private center: PauseMapPoint;
    private scale = DEFAULT_SCALE;
    private targetScale = DEFAULT_SCALE;
    private zoomAnchor: { sx: number; sy: number } | null = null;
    private targetCenter: PauseMapPoint | null = null;

    private drag: { sx: number; sy: number; center: PauseMapPoint; moved: boolean; button: number } | null = null;
    private hovered: PauseMapBlip | null = null;

    private dirty = true;
    private frame = 0;
    private destroyed = false;
    private renderFailed = false;

    public player: PauseMapPlayer;
    public waypoint: PauseMapPoint | null = null;
    public highlight: PauseMapPoint | null = null;
    public route: PauseMapPoint[] = [];
    public blips: PauseMapBlip[] = [];
    public zones: PauseMapZone[] = [];
    public layers: PauseMapLayer[] = [];

    private regionLabels: Label[] = [];
    private readonly postalLabels: Label[] = Postals.map(([text, x, y]) => ({ text, x, y, priority: 0 }));

    constructor(
        private readonly canvas: HTMLCanvasElement,
        player: PauseMapPlayer,
        private readonly callbacks: PauseMapRendererCallbacks,
    ) {
        this.ctx = canvas.getContext('2d');
        this.player = player;
        this.center = { x: player.x, y: player.y };

        canvas.addEventListener('wheel', this.onWheel, { passive: false });
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('pointerleave', this.onPointerLeave);
        canvas.addEventListener('contextmenu', this.onContextMenu);

        mapImageListeners.add(this.onMapImagesChange);
        preloadPauseMap();
        this.frame = requestAnimationFrame(this.loop);
    }

    public destroy(): void {
        this.destroyed = true;
        mapImageListeners.delete(this.onMapImagesChange);
        cancelAnimationFrame(this.frame);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        this.canvas.removeEventListener('pointermove', this.onPointerMove);
        this.canvas.removeEventListener('pointerup', this.onPointerUp);
        this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    }

    public resize(width: number, height: number): void {
        this.dpr = window.devicePixelRatio || 1;
        this.width = width;
        this.height = height;
        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.scale = Math.max(this.scale, this.minScale());
        this.targetScale = Math.max(this.targetScale, this.minScale());
        this.clampCenter();
        this.invalidate();
    }

    public setRegions(regions: PauseMapRegion[] = []): void {
        this.regionLabels = regions.map((region) => ({
            x: region.x,
            y: region.y,
            text: region.name.toUpperCase(),
            priority: region.weight,
        }));
        this.invalidate();
    }

    public setBlips(blips: PauseMapBlip[] = []): void {
        const isBottom = (blip: PauseMapBlip) => (BOTTOM_BLIP_SPRITES.includes(blip.sprite) ? 0 : 1);

        this.blips = [...blips].sort((a, b) => isBottom(a) - isBottom(b));

        for (const blip of blips) {
            this.loadIcon(blip.sprite);
        }

        this.invalidate();
    }

    public focus(point: PauseMapPoint, highlight = false): void {
        this.highlight = highlight ? { ...point } : null;
        this.targetCenter = { ...point };
        this.targetScale = Math.max(this.targetScale, 1);
        this.zoomAnchor = null;
        this.invalidate();
    }

    public invalidate(): void {
        this.dirty = true;
    }

    private minScale(): number {
        return Math.min(this.width / (MAX_X - MIN_X), this.height / (MAX_Y - MIN_Y)) * MIN_SCALE_MARGIN;
    }

    private toScreen(x: number, y: number): [number, number] {
        return [(x - this.center.x) * this.scale + this.width / 2, (this.center.y - y) * this.scale + this.height / 2];
    }

    private toWorld(sx: number, sy: number): PauseMapPoint {
        return {
            x: this.center.x + (sx - this.width / 2) / this.scale,
            y: this.center.y - (sy - this.height / 2) / this.scale,
        };
    }

    private clampCenter(): void {
        const halfWidth = this.width / 2 / this.scale;
        const halfHeight = this.height / 2 / this.scale;

        this.center.x =
            halfWidth * 2 >= MAX_X - MIN_X
                ? (MIN_X + MAX_X) / 2
                : Math.min(Math.max(this.center.x, MIN_X + halfWidth), MAX_X - halfWidth);
        this.center.y =
            halfHeight * 2 >= MAX_Y - MIN_Y
                ? (MIN_Y + MAX_Y) / 2
                : Math.min(Math.max(this.center.y, MIN_Y + halfHeight), MAX_Y - halfHeight);
    }

    private loop = (): void => {
        if (this.destroyed) {
            return;
        }

        this.frame = requestAnimationFrame(this.loop);

        let animating = false;

        if (Math.abs(this.targetScale - this.scale) > this.scale * 0.001) {
            const anchor = this.zoomAnchor ?? { sx: this.width / 2, sy: this.height / 2 };
            const before = this.toWorld(anchor.sx, anchor.sy);

            this.scale += (this.targetScale - this.scale) * ANIMATION_SPEED;
            this.center.x = before.x - (anchor.sx - this.width / 2) / this.scale;
            this.center.y = before.y + (anchor.sy - this.height / 2) / this.scale;
            animating = true;
        } else if (this.scale !== this.targetScale) {
            this.scale = this.targetScale;
            animating = true;
        }

        if (this.targetCenter) {
            const dx = this.targetCenter.x - this.center.x;
            const dy = this.targetCenter.y - this.center.y;

            if (Math.hypot(dx, dy) * this.scale < 0.5) {
                this.center = { ...this.targetCenter };
                this.targetCenter = null;
            } else {
                this.center.x += dx * ANIMATION_SPEED;
                this.center.y += dy * ANIMATION_SPEED;
            }

            animating = true;
        }

        if (animating) {
            this.clampCenter();
        }

        if ((animating || this.dirty) && this.width > 0 && this.height > 0) {
            this.dirty = false;

            try {
                this.render();
            } catch (error) {
                if (!this.renderFailed) {
                    this.renderFailed = true;
                    console.error('[pause-map] render failed', error);
                }
            }
        }
    };

    private onMapImagesChange = (): void => {
        this.invalidate();
    };

    private onWheel = (event: WheelEvent): void => {
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

        this.zoomAnchor = { sx: event.clientX - rect.left, sy: event.clientY - rect.top };
        this.targetCenter = null;
        this.targetScale = Math.min(MAX_SCALE, Math.max(this.minScale(), this.targetScale * factor));
    };

    private onPointerDown = (event: PointerEvent): void => {
        if (this.highlight) {
            this.highlight = null;
            this.invalidate();
        }

        this.canvas.setPointerCapture(event.pointerId);
        this.drag = {
            sx: event.clientX,
            sy: event.clientY,
            center: { ...this.center },
            moved: false,
            button: event.button,
        };
        this.targetCenter = null;
    };

    private onPointerMove = (event: PointerEvent): void => {
        if (this.drag) {
            const dx = event.clientX - this.drag.sx;
            const dy = event.clientY - this.drag.sy;

            if (!this.drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
                return;
            }

            this.drag.moved = true;
            this.center = { x: this.drag.center.x - dx / this.scale, y: this.drag.center.y + dy / this.scale };
            this.clampCenter();
            this.setHovered(null);
            this.invalidate();

            return;
        }

        const rect = this.canvas.getBoundingClientRect();

        this.updateHover(event.clientX - rect.left, event.clientY - rect.top);
    };

    private onPointerUp = (event: PointerEvent): void => {
        const drag = this.drag;

        this.drag = null;
        this.canvas.releasePointerCapture(event.pointerId);

        if (!drag || drag.moved) {
            return;
        }

        if (drag.button === 2) {
            this.callbacks.onRightClick();
            return;
        }

        if (drag.button === 0) {
            const rect = this.canvas.getBoundingClientRect();
            const sx = event.clientX - rect.left;
            const sy = event.clientY - rect.top;
            const blip = this.layers.includes('blips') ? this.findBlipAt(sx, sy, false) : null;

            this.callbacks.onClick(blip ? { x: blip.x, y: blip.y } : this.toWorld(sx, sy));
        }
    };

    private onPointerLeave = (): void => {
        this.setHovered(null);
    };

    private onContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
    };

    private updateHover(sx: number, sy: number): void {
        if (!this.layers.includes('blips')) {
            this.setHovered(null);
            return;
        }

        this.setHovered(this.findBlipAt(sx, sy, true));
    }

    private findBlipAt(sx: number, sy: number, namedOnly: boolean): PauseMapBlip | null {
        let best: PauseMapBlip | null = null;
        let bestDistance = HOVER_RADIUS;

        for (const blip of this.blips) {
            if (namedOnly && !blip.name) {
                continue;
            }

            const [bx, by] = this.toScreen(blip.x, blip.y);
            const distance = Math.hypot(bx - sx, by - sy);

            if (distance <= bestDistance) {
                best = blip;
                bestDistance = distance;
            }
        }

        return best;
    }

    private setHovered(blip: PauseMapBlip | null): void {
        if (blip === this.hovered) {
            return;
        }

        this.hovered = blip;

        if (!blip) {
            this.callbacks.onHover(null);
            return;
        }

        const [x, y] = this.toScreen(blip.x, blip.y);

        this.callbacks.onHover({ x, y, name: blip.name });
    }

    private loadIcon(sprite: number): void {
        if (iconImages.has(sprite)) {
            return;
        }

        iconImages.set(sprite, null);
        loadImage(getBlipIconUrl(sprite))
            .then((image) => {
                iconImages.set(sprite, image);
                this.invalidate();
            })
            .catch(() => undefined);
    }

    private getIcon(sprite: number, color: number): HTMLCanvasElement | null {
        const key = `${sprite}-${color}`;

        if (tintedIcons.has(key)) {
            return tintedIcons.get(key);
        }

        const image = iconImages.get(sprite);

        if (!image) {
            return null;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = ICON_RESOLUTION;
        canvas.height = ICON_RESOLUTION;
        ctx.drawImage(image, 0, 0, ICON_RESOLUTION, ICON_RESOLUTION);

        if (!UNTINTED_BLIP_COLORS.includes(color)) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = getBlipColor(color);
            ctx.fillRect(0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(image, 0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
        }

        tintedIcons.set(key, canvas);

        return canvas;
    }

    private render(): void {
        const ctx = this.ctx;

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);

        this.drawMap();

        if (this.layers.includes('blips')) {
            this.drawZones();
        }

        if (this.route?.length > 1) {
            this.drawRoute();
        }

        const zoomLevel = this.scale;

        if (this.layers.includes('regions') && zoomLevel >= REGION_SCALE[0] && zoomLevel < REGION_SCALE[1]) {
            const size = Math.min(20, Math.max(10, 10 + Math.log2(zoomLevel / 0.1) * 3));

            this.drawLabels(this.regionLabels, size, 'region');
        }

        if (this.layers.includes('postals') && zoomLevel >= POSTAL_MIN_SCALE) {
            const size = Math.min(14, 11 + Math.log2(zoomLevel / POSTAL_MIN_SCALE) * 1.5);

            this.drawLabels(this.postalLabels, size, 'postal');
        }

        if (this.layers.includes('blips')) {
            this.drawBlips();
        }

        if (this.waypoint) {
            this.drawWaypoint(this.waypoint);
        }

        if (this.highlight) {
            this.drawHighlight(this.highlight);
        }

        this.drawPlayer(this.player);
    }

    private drawMap(): void {
        const ctx = this.ctx;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (mapImages.size === 0) {
            const failed = failedMapImages.size > 0 && loadingMapImages.size === 0;

            ctx.font = '600 16px Prompt, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillText(
                failed ? 'Impossible de charger la carte (ressource soz-map-tiles)' : 'Chargement de la carte…',
                this.width / 2,
                this.height / 2,
            );

            return;
        }

        for (const source of MapImageSources) {
            const image = mapImages.get(source.url);

            if (!image) {
                continue;
            }

            const [x0, y0] = this.toScreen(image.x0, image.y0);
            const [x1, y1] = this.toScreen(image.x1, image.y1);

            if (x1 < 0 || y1 < 0 || x0 > this.width || y0 > this.height) {
                continue;
            }

            const drawnWidth = (x1 - x0) * this.dpr;
            let level = 0;

            while (level + 1 < image.levels.length && image.widths[level + 1] >= drawnWidth) {
                level++;
            }

            const left = Math.round(x0);
            const top = Math.round(y0);

            ctx.drawImage(image.levels[level], left, top, Math.round(x1) - left, Math.round(y1) - top);
        }
    }

    private drawRoute(): void {
        const ctx = this.ctx;

        ctx.beginPath();

        this.route.forEach((point, index) => {
            const [x, y] = this.toScreen(point.x, point.y);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#b05cf0';
        ctx.stroke();
    }

    private drawZones(): void {
        const ctx = this.ctx;

        for (const zone of this.zones) {
            const [x, y] = this.toScreen(zone.x, zone.y);
            const radius = zone.radius * this.scale;

            if (x + radius < 0 || y + radius < 0 || x - radius > this.width || y - radius > this.height) {
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

    private drawLabels(labels: Label[], size: number, kind: 'region' | 'postal'): void {
        const ctx = this.ctx;
        const padding = kind === 'postal' ? 4 : 3;
        const boxes: [number, number, number, number][] = [];
        const sorted = kind === 'region' ? [...labels].sort((a, b) => b.priority - a.priority) : labels;

        ctx.font = `${kind === 'region' ? 700 : 600} ${size}px Prompt, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const label of sorted) {
            const [x, y] = this.toScreen(label.x, label.y);

            if (x < -100 || y < -50 || x > this.width + 100 || y > this.height + 50) {
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

    private drawBlips(): void {
        const ctx = this.ctx;

        for (const blip of this.blips) {
            const [x, y] = this.toScreen(blip.x, blip.y);
            const size = BLIP_SIZE * Math.min(1.3, Math.max(0.7, blip.scale));

            if (x < -size || y < -size || x > this.width + size || y > this.height + size) {
                continue;
            }

            const icon = this.getIcon(blip.sprite, blip.color);

            if (icon) {
                ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = getBlipColor(blip.color);
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.stroke();
            }
        }
    }

    private drawWaypoint(waypoint: PauseMapPoint): void {
        const ctx = this.ctx;
        const [x, y] = this.toScreen(waypoint.x, waypoint.y);

        ctx.save();
        ctx.translate(x, y);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-4, -8, -12, -14, -12, -22);
        ctx.arc(0, -22, 12, Math.PI, 0);
        ctx.bezierCurveTo(12, -14, 4, -8, 0, 0);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
    }

    private drawHighlight(point: PauseMapPoint): void {
        const ctx = this.ctx;
        const [x, y] = this.toScreen(point.x, point.y);

        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    private drawPlayer(player: PauseMapPlayer): void {
        const ctx = this.ctx;
        const [x, y] = this.toScreen(player.x, player.y);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((-player.heading * Math.PI) / 180);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(9, 11);
        ctx.lineTo(0, 5);
        ctx.lineTo(-9, 11);
        ctx.closePath();
        ctx.fillStyle = '#34d399';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();
    }
}
