import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { BlipType } from '../../shared/blip';
import { NuiEvent } from '../../shared/event';
import { MinimapBlip, MinimapPoint, MinimapZone } from '../../shared/nui/minimap';
import { BlipFactory } from '../blip';
import { HudMinimapProvider } from '../hud/hud.minimap.provider';
import { NuiDispatch } from '../nui/nui.dispatch';

const MAX_BLIP_SPRITE = 1000;
const BLIP_SPRITES_PER_TICK = 100;
const WAYPOINT_BLIP_SPRITE = 8;
const RADIUS_BLIP_SPRITES = [9, 10];
const HIDDEN_BLIP_DISPLAYS = [0, 5];
const FRAME_INTERVAL = 33;
const ANIMATION_KVP = 'soz_pause_map_animation';
const GPS_SLOTS = [0, 1];
const ROUTE_BUDGET_MS = 3;
const ROUTE_INTERVAL = 250;
const ROUTE_NEAR_STEP = 5;
const ROUTE_NEAR_DISTANCE = 1500;
const ROUTE_FAR_STEP = 20;
const ROUTE_FAR_POINTS = 300;
const ROUTE_MAX_POINTS = ROUTE_NEAR_DISTANCE / ROUTE_NEAR_STEP + ROUTE_FAR_POINTS;

type RouteJob = {
    slot: number;
    points: MinimapPoint[];
    length: number;
    farStep: number;
    distance: number;
    samples: number;
};

@Provider()
export class PauseMinimapProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(HudMinimapProvider)
    private hudMinimapProvider: HudMinimapProvider;

    @Inject(BlipFactory)
    private blipFactory: BlipFactory;

    public frameInterval = FRAME_INTERVAL;

    private lastFrameAt = 0;
    private scanSprite = 0;
    private scanBlips: MinimapBlip[] = [];
    private scanExcluded = new Set<number>();
    private knownBlips = new Map<number, { id: string; actions: boolean }>();
    private blipSignature = '';
    private zoneSignature = '';
    private routeSignature = '';
    private waypointSignature = '';
    private routeJob: RouteJob | null = null;
    private lastRouteStart = 0;

    @Once(OnceStep.NuiLoaded)
    public sendSettings(): void {
        this.nuiDispatch.dispatch('minimap', 'Settings', { animation: this.isAnimationEnabled() });
    }

    public isAnimationEnabled(): boolean {
        return GetResourceKvpString(ANIMATION_KVP) !== 'off';
    }

    public setAnimationEnabled(enabled: boolean): void {
        SetResourceKvp(ANIMATION_KVP, enabled ? 'on' : 'off');
        this.nuiDispatch.dispatch('minimap', 'Settings', { animation: enabled });
    }

    @OnNuiEvent(NuiEvent.MinimapSetWaypoint)
    public async onSetWaypoint({ x, y }: MinimapPoint): Promise<void> {
        SetNewWaypoint(x, y);
        this.waypointSignature = '';
        this.dispatchWaypoint();
    }

    @OnNuiEvent(NuiEvent.MinimapRemoveWaypoint)
    public async onRemoveWaypoint(): Promise<void> {
        SetWaypointOff();
        this.waypointSignature = '';
        this.dispatchWaypoint();
    }

    @Tick(TickInterval.EVERY_FRAME)
    public onFrame(): void {
        const now = GetGameTimer();

        if (now - this.lastFrameAt < this.frameInterval) {
            return;
        }

        this.lastFrameAt = now;

        const ped = PlayerPedId();
        const vehicle = GetVehiclePedIsIn(ped, false);
        const entity = vehicle || ped;
        const [x, y] = GetEntityCoords(ped, false);
        const [, , camHeading] = GetGameplayCamRot(2);

        this.nuiDispatch.dispatch('minimap', 'Frame', {
            x,
            y,
            heading: GetEntityHeading(ped),
            camHeading,
            speed: GetEntitySpeed(entity),
            altitude: GetEntityHeightAboveGround(entity),
            visible: this.hudMinimapProvider.radarWanted && IsGameplayCamRendering() && !IsPauseMenuActive(),
        });
    }

    @Tick(100)
    public onBlips(): void {
        if (this.scanSprite === 0) {
            this.startScan();
        }

        const end = Math.min(MAX_BLIP_SPRITE, this.scanSprite + BLIP_SPRITES_PER_TICK - 1);

        this.scanBlipRange(this.scanSprite, end);

        if (end < MAX_BLIP_SPRITE) {
            this.scanSprite = end + 1;

            return;
        }

        this.scanSprite = 0;
        this.publishBlips();
        this.dispatchZones();
    }

    public scanNow(): void {
        this.startScan();
        this.scanBlipRange(0, MAX_BLIP_SPRITE);
        this.scanSprite = 0;
        this.publishBlips();
        this.dispatchZones();
    }

    @OnNuiEvent(NuiEvent.MinimapBlipClick)
    public async onBlipClick({ id }: { id: string }): Promise<void> {
        this.blipFactory.showActions(id);
    }

    private startScan(): void {
        this.scanBlips = [];
        this.scanExcluded = new Set([GetMainPlayerBlipId(), GetNorthRadarBlip()]);
        this.knownBlips = new Map();

        for (const { id, gameId, actions } of this.blipFactory.getAll().values()) {
            this.knownBlips.set(gameId, { id, actions: Boolean(actions?.length) });
        }
    }

    private publishBlips(): void {
        const signature = this.scanBlips
            .map(blip => `${blip.id ?? ''}:${blip.sprite}:${blip.color}:${blip.x}:${blip.y}`)
            .join('|');

        if (signature !== this.blipSignature) {
            this.blipSignature = signature;
            this.nuiDispatch.dispatch('minimap', 'Blips', this.scanBlips);
        }
    }

    @Tick(TickInterval.EVERY_FRAME)
    public onRouteStep(): void {
        const now = GetGameTimer();

        if (!this.routeJob) {
            if (now - this.lastRouteStart < ROUTE_INTERVAL) {
                return;
            }

            this.lastRouteStart = now;
            this.dispatchWaypoint();
            this.routeJob = this.startRouteJob(GPS_SLOTS[0]);
        }

        const start = GetGameTimer();

        while (this.routeJob && GetGameTimer() - start < ROUTE_BUDGET_MS) {
            const job = this.routeJob;

            if (!this.stepRouteJob(job)) {
                continue;
            }

            if (job.points.length > 2) {
                this.finishRoute(job.points);
            } else if (job.slot !== GPS_SLOTS[GPS_SLOTS.length - 1]) {
                this.routeJob = this.startRouteJob(GPS_SLOTS[GPS_SLOTS.indexOf(job.slot) + 1]);
            } else {
                this.finishRoute([]);
            }
        }
    }

    private dispatchWaypoint(): void {
        let waypoint: MinimapPoint | null = null;

        if (IsWaypointActive()) {
            const [x, y] = GetBlipInfoIdCoord(GetFirstBlipInfoId(WAYPOINT_BLIP_SPRITE));

            waypoint = { x, y };
        }

        const signature = waypoint ? `${waypoint.x}:${waypoint.y}` : '';

        if (signature !== this.waypointSignature) {
            this.waypointSignature = signature;
            this.nuiDispatch.dispatch('minimap', 'Waypoint', waypoint);
        }
    }

    private startRouteJob(slot: number): RouteJob {
        const [x, y] = GetEntityCoords(PlayerPedId(), false);
        const length = slot === 0 && GetGpsBlipRouteFound() ? GetGpsBlipRouteLength() : 0;

        return {
            slot,
            points: [{ x, y }],
            length,
            farStep: Math.max(ROUTE_FAR_STEP, (length - ROUTE_NEAR_DISTANCE) / ROUTE_FAR_POINTS),
            distance: 0,
            samples: 0,
        };
    }

    private stepRouteJob(job: RouteJob): boolean {
        job.samples++;
        job.distance += job.distance < ROUTE_NEAR_DISTANCE ? ROUTE_NEAR_STEP : job.farStep;

        const [found, position] = GetPosAlongGpsTypeRoute(true, job.distance, job.slot);

        if (!found) {
            return true;
        }

        const [x, y] = position;
        const previous = job.points[job.points.length - 1];

        if (Math.hypot(x - previous.x, y - previous.y) < 0.5) {
            return true;
        }

        job.points.push({ x, y });

        return (job.length > 0 && job.distance >= job.length) || job.samples >= ROUTE_MAX_POINTS;
    }

    private finishRoute(route: MinimapPoint[]): void {
        this.routeJob = null;

        const first = route[0];
        const middle = route[Math.floor(route.length / 2)];
        const last = route[route.length - 1];
        const signature = last
            ? `${route.length}:${Math.round(first.x / 3)}:${Math.round(first.y / 3)}:${Math.round(middle.x)}:${Math.round(middle.y)}:${Math.round(last.x)}:${Math.round(last.y)}`
            : '';

        if (signature !== this.routeSignature) {
            this.routeSignature = signature;
            this.nuiDispatch.dispatch('minimap', 'Route', route);
        }
    }

    private dispatchZones(): void {
        const zones: MinimapZone[] = [];

        for (const { gameId, blip } of this.blipFactory.getAll().values()) {
            if (blip.type !== BlipType.Radius || blip.hidden || !blip.radius || !DoesBlipExist(gameId)) {
                continue;
            }

            const [x, y] = GetBlipCoords(gameId);

            zones.push({ x, y, radius: blip.radius, color: blip.color ?? 0, alpha: blip.alpha ?? 128 });
        }

        const signature = zones.map(zone => `${zone.x}:${zone.y}:${zone.radius}:${zone.color}:${zone.alpha}`).join('|');

        if (signature !== this.zoneSignature) {
            this.zoneSignature = signature;
            this.nuiDispatch.dispatch('minimap', 'Zones', zones);
        }
    }

    private scanBlipRange(from: number, to: number): void {
        for (let sprite = from; sprite <= to; sprite++) {
            if (sprite === WAYPOINT_BLIP_SPRITE || RADIUS_BLIP_SPRITES.includes(sprite)) {
                continue;
            }

            for (let handle = GetFirstBlipInfoId(sprite); DoesBlipExist(handle); handle = GetNextBlipInfoId(sprite)) {
                if (
                    this.scanExcluded.has(handle) ||
                    GetBlipAlpha(handle) === 0 ||
                    HIDDEN_BLIP_DISPLAYS.includes(GetBlipInfoIdDisplay(handle))
                ) {
                    continue;
                }

                const [x, y] = GetBlipCoords(handle);
                const known = this.knownBlips.get(handle);

                this.scanBlips.push({
                    id: known?.id,
                    actions: known?.actions,
                    x,
                    y,
                    sprite: GetBlipSprite(handle),
                    color: GetBlipColour(handle),
                    rotation: GetBlipRotation(handle),
                });
            }
        }
    }
}
