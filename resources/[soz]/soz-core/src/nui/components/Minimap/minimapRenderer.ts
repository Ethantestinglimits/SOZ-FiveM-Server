import { MinimapBlip, MinimapFrame, MinimapZone } from '../../../shared/nui/minimap';
import { getBlipColor, UNTINTED_BLIP_COLORS } from './blipColors';

const MAP_URL = 'https://cfx-nui-soz-map-tiles/map';
const BLIP_URL = 'https://cfx-nui-soz-map-tiles/blips';
const ASSETS_VERSION = 5;
const ORIGIN_X = -4140;
const ORIGIN_Y = 8400;
const IMAGE_UNITS = 4500;
const MIP_LEVELS = [1, 0.5, 0.25, 0.125];
const ICON_RESOLUTION = 64;
const BLIP_SIZE = 16;
const BASE_RANGE = 450;
const SPEED_RANGE = 9;
const ALTITUDE_RANGE = 2.5;
const MAX_RANGE = 2600;
const SEA_COLOR = '#4f86a8';
const BORDER_RADIUS = 12;
const PRESENCE_RATE = 10;
const RANGE_RATE = 2;
const SMOOTHING_RATE = 18;

export type MinimapRect = { x: number; y: number; w: number; h: number };

type MapImage = { x0: number; y0: number; x1: number; y1: number; levels: CanvasImageSource[]; widths: number[] };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const lerpAngle = (a: number, b: number, t: number) => {
    let delta = (b - a) % 360;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    return a + delta * t;
};

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
    private range = BASE_RANGE;
    private presence = 0;
    private lockedRect: MinimapRect | null = null;
    private lastAt = 0;
    private handle = 0;
    private destroyed = false;

    public rect: MinimapRect = { x: 0, y: 0, w: 0, h: 0 };
    public blips: MinimapBlip[] = [];
    public zones: MinimapZone[] = [];

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d');
        this.canvas.style.borderRadius = `${BORDER_RADIUS}px`;
        this.loadMap();
        this.handle = requestAnimationFrame(this.loop);
    }

    public destroy(): void {
        this.destroyed = true;
        cancelAnimationFrame(this.handle);
    }

    public setFrame(frame: MinimapFrame): void {
        this.frame = frame;

        if (!this.displayed) {
            this.displayed = { ...frame };
        }
    }

    public setBlips(blips: MinimapBlip[]): void {
        this.blips = blips;

        for (const blip of blips) {
            this.loadIcon(blip.sprite);
        }
    }

    public setZones(zones: MinimapZone[]): void {
        this.zones = zones;
    }

    private loadMap(): void {
        const sources = [
            ...[0, 1, 2].flatMap(row =>
                [0, 1].map(col => ({
                    url: `${MAP_URL}/${row}_${col}.webp?v=${ASSETS_VERSION}`,
                    x0: ORIGIN_X + col * IMAGE_UNITS,
                    y0: ORIGIN_Y - row * IMAGE_UNITS,
                    x1: ORIGIN_X + (col + 1) * IMAGE_UNITS,
                    y1: ORIGIN_Y - (row + 1) * IMAGE_UNITS,
                }))
            ),
            { url: `${MAP_URL}/cayo.webp?v=${ASSETS_VERSION}`, x0: 3726, y0: -4139, x1: 5733, y1: -6150 },
        ];

        for (const source of sources) {
            loadImage(source.url)
                .then(image => {
                    const levels: CanvasImageSource[] = [image];
                    const widths = [image.naturalWidth];

                    for (const ratio of MIP_LEVELS.slice(1)) {
                        const level = downscale(image, ratio);

                        levels.push(level);
                        widths.push(level.width);
                    }

                    this.images.push({ ...source, levels, widths });
                })
                .catch(error => console.error('[minimap]', error));
        }
    }

    private loadIcon(sprite: number): void {
        if (this.icons.has(sprite)) {
            return;
        }

        this.icons.set(sprite, null);
        loadImage(`${BLIP_URL}/${sprite}.webp?v=${ASSETS_VERSION}`)
            .then(image => this.icons.set(sprite, image))
            .catch(() => undefined);
    }

    private getIcon(sprite: number, color: number): CanvasImageSource | null {
        const image = this.icons.get(sprite);

        if (!image) {
            return null;
        }

        if (UNTINTED_BLIP_COLORS.includes(color)) {
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
        ctx.fillStyle = getBlipColor(color);
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
        this.update(dt);
        this.render();
        this.handle = requestAnimationFrame(this.loop);
    };

    private update(dt: number): void {
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

        const targetRange = Math.min(
            MAX_RANGE,
            BASE_RANGE + this.frame.speed * SPEED_RANGE + Math.max(0, this.frame.altitude) * ALTITUDE_RANGE
        );

        this.range = lerp(this.range, targetRange, 1 - Math.exp(-dt * RANGE_RATE));
        this.presence = lerp(this.presence, this.frame.visible ? 1 : 0, 1 - Math.exp(-dt * PRESENCE_RATE));

        if (this.frame.visible) {
            this.lockedRect = { ...this.rect };
        }
    }

    private render(): void {
        const style = this.canvas.style;
        const frame = this.displayed;
        const rect = this.frame?.visible || !this.lockedRect ? this.rect : this.lockedRect;

        if (!frame || this.presence < 0.02 || rect.w < 1 || rect.h < 1) {
            style.display = 'none';

            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(rect.w * dpr);
        const height = Math.round(rect.h * dpr);

        style.display = 'block';
        style.opacity = String(this.presence);
        style.left = `${rect.x}px`;
        style.top = `${rect.y}px`;
        style.width = `${rect.w}px`;
        style.height = `${rect.h}px`;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        const scale = rect.w / this.range;
        const rotation = toRadians(frame.camHeading);
        const toScreen = (x: number, y: number): [number, number] => {
            const dx = (x - frame.x) * scale;
            const dy = (frame.y - y) * scale;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);

            return [dx * cos - dy * sin + rect.w / 2, dx * sin + dy * cos + rect.h / 2];
        };
        const ctx = this.ctx;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = SEA_COLOR;
        ctx.fillRect(0, 0, rect.w, rect.h);

        this.drawMap(rect, frame, scale, rotation, dpr);
        this.drawZones(rect, scale, toScreen);
        this.drawBlips(rect, toScreen);
        this.drawPlayer(frame, rotation, toScreen);
    }

    private drawMap(rect: MinimapRect, frame: MinimapFrame, scale: number, rotation: number, dpr: number): void {
        const ctx = this.ctx;
        const radius = Math.hypot(rect.w, rect.h) / 2;

        ctx.save();
        ctx.translate(rect.w / 2, rect.h / 2);
        ctx.rotate(rotation);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (const image of this.images) {
            const x = (image.x0 - frame.x) * scale;
            const y = (frame.y - image.y0) * scale;
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

        ctx.restore();
    }

    private drawZones(rect: MinimapRect, scale: number, toScreen: (x: number, y: number) => [number, number]): void {
        const ctx = this.ctx;

        for (const zone of this.zones) {
            const [x, y] = toScreen(zone.x, zone.y);
            const radius = zone.radius * scale;

            if (x + radius < 0 || y + radius < 0 || x - radius > rect.w || y - radius > rect.h) {
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

    private drawBlips(rect: MinimapRect, toScreen: (x: number, y: number) => [number, number]): void {
        const ctx = this.ctx;

        for (const blip of this.blips) {
            const [x, y] = toScreen(blip.x, blip.y);

            if (x < -BLIP_SIZE || y < -BLIP_SIZE || x > rect.w + BLIP_SIZE || y > rect.h + BLIP_SIZE) {
                continue;
            }

            const icon = this.getIcon(blip.sprite, blip.color);

            if (icon) {
                ctx.drawImage(icon, x - BLIP_SIZE / 2, y - BLIP_SIZE / 2, BLIP_SIZE, BLIP_SIZE);
            } else {
                ctx.fillStyle = getBlipColor(blip.color);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    private drawPlayer(
        frame: MinimapFrame,
        rotation: number,
        toScreen: (x: number, y: number) => [number, number]
    ): void {
        const ctx = this.ctx;
        const [x, y] = toScreen(frame.x, frame.y);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation - toRadians(frame.heading));
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
}
