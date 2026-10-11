import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { wait } from '../../core/utils';
import { BlipType } from '../../shared/blip';
import { NuiEvent, ServerEvent } from '../../shared/event';
import { Control } from '../../shared/input';
import {
    PauseMapBlip,
    PauseMapLayer,
    PauseMapPlayer,
    PauseMapPoint,
    PauseMapRegion,
    PauseMapSettings,
    PauseMapZone,
} from '../../shared/nui/pause_menu';
import { BlipFactory } from '../blip';
import { JobService } from '../job/job.service';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PlayerService } from '../player/player.service';
import { JobGradeRepository } from '../repository/job.grade.repository';
import { BlurService } from '../utils/blur.service';

const BLUR_REASON = 'pause_menu';
const BLUR_DELAY = 250;
const NUI_FOCUS_COOLDOWN = 300;
const FRONTEND_OPEN_TIMEOUT = 2000;
const FRONTEND_MENU = GetHashKey('FE_MENU_VERSION_MP_PAUSE');
const MAP_SETTINGS_KVP = 'soz_pause_map';
const WAYPOINT_BLIP_SPRITE = 8;
const MAX_BLIP_SPRITE = 1000;
const RADIUS_BLIP_SPRITES = [9, 10];
const HIDDEN_BLIP_DISPLAYS = [0, 5];
const REGION_STEP = 125;
const REGION_BOUNDS = { minX: -3800, maxX: 4400, minY: -4000, maxY: 8000 };
const REGION_EXCLUDED_ZONES = ['OCEANA'];
const GPS_SLOTS = [0, 1];
const ROUTE_MIN_STEP = 15;
const ROUTE_MAX_POINTS = 600;
const ROUTE_RETRY_COUNT = 20;
const ROUTE_RETRY_DELAY = 100;
const ROUTE_PENDING_DURATION = 5000;
const MAP_LAYERS: PauseMapLayer[] = ['postals', 'regions', 'blips'];

const DEFAULT_MAP_SETTINGS: PauseMapSettings = {
    layers: ['blips', 'regions'],
};

@Provider()
export class PauseMenuProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(JobService)
    private jobService: JobService;

    @Inject(JobGradeRepository)
    private jobGradeRepository: JobGradeRepository;

    @Inject(BlurService)
    private blurService: BlurService;

    @Inject(BlipFactory)
    private blipFactory: BlipFactory;

    private opened = false;
    private lastNuiFocusAt = 0;
    private frontendRequestedAt: number | null = null;
    private frontendOpened = false;
    private regions: PauseMapRegion[] | null = null;
    private routeSignature = '';
    private routePendingUntil = 0;

    public isOpen(): boolean {
        return this.opened;
    }

    @Tick(TickInterval.EVERY_FRAME)
    public onTick(): void {
        if (this.opened) {
            if (!this.isRoutePending()) {
                HideHudAndRadarThisFrame();
            }

            DisableControlAction(0, Control.FrontendPause, true);
            DisableControlAction(0, Control.FrontendPauseAlternate, true);

            return;
        }

        if (this.checkFrontendReturn()) {
            return;
        }

        if (IsNuiFocused()) {
            this.lastNuiFocusAt = GetGameTimer();

            return;
        }

        if (IsPauseMenuActive()) {
            return;
        }

        DisableControlAction(0, Control.FrontendPauseAlternate, true);

        if (
            IsDisabledControlJustPressed(0, Control.FrontendPauseAlternate) &&
            GetGameTimer() - this.lastNuiFocusAt > NUI_FOCUS_COOLDOWN
        ) {
            this.open();
        }
    }

    @Tick(200)
    public onPlayerMove(): void {
        if (this.opened) {
            this.nuiDispatch.dispatch('pause_menu', 'SetPlayer', this.getPlayerPosition());
        }
    }

    @Tick(500)
    public onRouteUpdate(): void {
        if (!this.opened) {
            return;
        }

        if (this.isRoutePending()) {
            RefreshWaypoint();
        }

        this.dispatchRoute();
    }

    public open(): void {
        const player = this.playerService.getPlayer();

        if (!player || this.opened) {
            return;
        }

        this.opened = true;
        this.routePendingUntil = GetGameTimer() + ROUTE_PENDING_DURATION;
        this.blurService.add(BLUR_REASON, BLUR_DELAY);

        if (IsWaypointActive()) {
            RefreshWaypoint();
        }

        const job = this.jobService.getJob(player.job.id);
        const grade = this.jobGradeRepository.find(Number(player.job.grade));

        this.nuiDispatch.dispatch('pause_menu', 'Open', {
            firstname: player.charinfo.firstname,
            lastname: player.charinfo.lastname,
            job: job?.label ?? null,
            grade: grade && grade.jobId === player.job.id ? grade.name : null,
            onDuty: player.job.onduty,
            serverId: GetPlayerServerId(PlayerId()),
            player: this.getPlayerPosition(),
            waypoint: this.getWaypoint(),
            route: this.computeRoute(),
            blips: this.getBlips(),
            zones: this.getZones(),
            regions: this.getRegions(),
            settings: this.getMapSettings(),
        });
    }

    public close(): void {
        this.frontendRequestedAt = null;
        this.frontendOpened = false;

        if (!this.opened) {
            return;
        }

        this.opened = false;
        this.lastNuiFocusAt = GetGameTimer();
        this.blurService.remove(BLUR_REASON, BLUR_DELAY);
        this.nuiDispatch.dispatch('pause_menu', 'Close');
    }

    @OnNuiEvent(NuiEvent.PauseMenuClose)
    public async onClose(): Promise<void> {
        this.close();
    }

    @OnNuiEvent(NuiEvent.PauseMenuOpenMap)
    public async onOpenMap(): Promise<void> {
        this.openFrontend();
    }

    @OnNuiEvent(NuiEvent.PauseMenuOpenSettings)
    public async onOpenSettings(): Promise<void> {
        this.openFrontend();
    }

    @OnNuiEvent(NuiEvent.PauseMenuQuit)
    public async onQuit(): Promise<void> {
        this.close();
        TriggerServerEvent(ServerEvent.PAUSE_MENU_QUIT);
    }

    @OnNuiEvent(NuiEvent.PauseMenuSaveMapSettings)
    public async onSaveMapSettings(settings: PauseMapSettings): Promise<void> {
        SetResourceKvp(MAP_SETTINGS_KVP, JSON.stringify(settings));
    }

    @OnNuiEvent(NuiEvent.PauseMenuSetWaypoint)
    public async onSetWaypoint({ x, y }: PauseMapPoint): Promise<void> {
        SetNewWaypoint(x, y);
        RefreshWaypoint();
        this.routePendingUntil = GetGameTimer() + ROUTE_PENDING_DURATION;
        this.nuiDispatch.dispatch('pause_menu', 'SetWaypoint', { x, y });

        for (let i = 0; i < ROUTE_RETRY_COUNT && this.opened; i++) {
            await wait(ROUTE_RETRY_DELAY);

            if (GetGpsBlipRouteFound()) {
                this.dispatchRoute();
                return;
            }
        }
    }

    @OnNuiEvent(NuiEvent.PauseMenuRemoveWaypoint)
    public async onRemoveWaypoint(): Promise<void> {
        SetWaypointOff();
        this.nuiDispatch.dispatch('pause_menu', 'SetWaypoint', null);
        this.dispatchRoute();
    }

    private openFrontend(): void {
        this.close();
        this.frontendRequestedAt = GetGameTimer();
        ActivateFrontendMenu(FRONTEND_MENU, false, -1);
    }

    private checkFrontendReturn(): boolean {
        if (this.frontendRequestedAt !== null) {
            if (IsPauseMenuActive()) {
                this.frontendRequestedAt = null;
                this.frontendOpened = true;
            } else if (GetGameTimer() - this.frontendRequestedAt > FRONTEND_OPEN_TIMEOUT) {
                this.frontendRequestedAt = null;
            }

            return true;
        }

        if (this.frontendOpened && !IsPauseMenuActive()) {
            this.frontendOpened = false;
            this.open();

            return true;
        }

        return this.frontendOpened;
    }

    private isRoutePending(): boolean {
        return GetGameTimer() < this.routePendingUntil && IsWaypointActive() && !GetGpsBlipRouteFound();
    }

    private dispatchRoute(): void {
        const route = this.computeRoute();
        const last = route[route.length - 1];
        const signature = last ? `${route.length}:${Math.round(last.x)}:${Math.round(last.y)}` : '';

        if (signature === this.routeSignature) {
            return;
        }

        this.routeSignature = signature;
        this.nuiDispatch.dispatch('pause_menu', 'SetRoute', route);
    }

    private computeRoute(): PauseMapPoint[] {
        for (const slot of GPS_SLOTS) {
            const route = this.sampleRoute(slot);

            if (route.length > 1) {
                return route;
            }
        }

        return [];
    }

    private sampleRoute(slot: number): PauseMapPoint[] {
        const [px, py] = GetEntityCoords(PlayerPedId(), false);
        const points: PauseMapPoint[] = [{ x: px, y: py }];
        const length = slot === 0 && GetGpsBlipRouteFound() ? GetGpsBlipRouteLength() : 0;
        const step = Math.max(ROUTE_MIN_STEP, length / ROUTE_MAX_POINTS);

        for (let i = 1; i <= ROUTE_MAX_POINTS; i++) {
            const [found, position] = GetPosAlongGpsTypeRoute(true, i * step, slot);

            if (!found) {
                break;
            }

            const [x, y] = position;
            const previous = points[points.length - 1];

            if (Math.hypot(x - previous.x, y - previous.y) < 0.5) {
                break;
            }

            points.push({ x, y });

            if (length > 0 && i * step >= length) {
                break;
            }
        }

        return points.length > 2 ? points : [];
    }

    private getPlayerPosition(): PauseMapPlayer {
        const ped = PlayerPedId();
        const [x, y] = GetEntityCoords(ped, false);

        return { x, y, heading: GetEntityHeading(ped) };
    }

    private getWaypoint(): PauseMapPoint | null {
        if (!IsWaypointActive()) {
            return null;
        }

        const [x, y] = GetBlipInfoIdCoord(GetFirstBlipInfoId(WAYPOINT_BLIP_SPRITE));

        return { x, y };
    }

    private getBlips(): PauseMapBlip[] {
        const known = new Map<number, { id: string; name: string | null; scale: number }>();

        for (const [id, { gameId, blip }] of this.blipFactory.getAll()) {
            known.set(gameId, { id, name: blip.name ?? null, scale: blip.scale ?? 1 });
        }

        const excluded = new Set([GetMainPlayerBlipId(), GetNorthRadarBlip()]);
        const blips: PauseMapBlip[] = [];

        for (let sprite = 0; sprite <= MAX_BLIP_SPRITE; sprite++) {
            if (sprite === WAYPOINT_BLIP_SPRITE || RADIUS_BLIP_SPRITES.includes(sprite)) {
                continue;
            }

            for (let handle = GetFirstBlipInfoId(sprite); DoesBlipExist(handle); handle = GetNextBlipInfoId(sprite)) {
                if (
                    excluded.has(handle) ||
                    GetBlipAlpha(handle) === 0 ||
                    HIDDEN_BLIP_DISPLAYS.includes(GetBlipInfoIdDisplay(handle))
                ) {
                    continue;
                }

                const [x, y] = GetBlipCoords(handle);
                const info = known.get(handle);

                blips.push({
                    id: info?.id ?? `native-${handle}`,
                    name: info?.name ?? null,
                    sprite: GetBlipSprite(handle),
                    color: GetBlipColour(handle),
                    scale: info?.scale ?? 1,
                    x,
                    y,
                });
            }
        }

        return blips;
    }

    private getZones(): PauseMapZone[] {
        const zones: PauseMapZone[] = [];

        for (const [id, { gameId, blip }] of this.blipFactory.getAll()) {
            if (blip.type !== BlipType.Radius || blip.hidden || !blip.radius || !DoesBlipExist(gameId)) {
                continue;
            }

            const [x, y] = GetBlipCoords(gameId);

            zones.push({ id, x, y, radius: blip.radius, color: blip.color ?? 0, alpha: blip.alpha ?? 128 });
        }

        return zones;
    }

    private getRegions(): PauseMapRegion[] {
        if (this.regions) {
            return this.regions;
        }

        const zones = new Map<string, { x: number; y: number; count: number }>();

        for (let x = REGION_BOUNDS.minX; x <= REGION_BOUNDS.maxX; x += REGION_STEP) {
            for (let y = REGION_BOUNDS.minY; y <= REGION_BOUNDS.maxY; y += REGION_STEP) {
                const zone = GetNameOfZone(x, y, 100);

                if (!zone || REGION_EXCLUDED_ZONES.includes(zone)) {
                    continue;
                }

                const sum = zones.get(zone) ?? { x: 0, y: 0, count: 0 };

                zones.set(zone, { x: sum.x + x, y: sum.y + y, count: sum.count + 1 });
            }
        }

        this.regions = [...zones.entries()]
            .map(([zone, sum]) => ({
                name: GetLabelText(zone),
                x: sum.x / sum.count,
                y: sum.y / sum.count,
                weight: sum.count,
            }))
            .filter((region) => region.name && region.name !== 'NULL');

        return this.regions;
    }

    private getMapSettings(): PauseMapSettings {
        const saved = GetResourceKvpString(MAP_SETTINGS_KVP);

        if (!saved) {
            return DEFAULT_MAP_SETTINGS;
        }

        try {
            const { layers } = JSON.parse(saved) as Partial<PauseMapSettings>;

            return Array.isArray(layers)
                ? { layers: layers.filter((layer) => MAP_LAYERS.includes(layer)) }
                : DEFAULT_MAP_SETTINGS;
        } catch {
            return DEFAULT_MAP_SETTINGS;
        }
    }
}
