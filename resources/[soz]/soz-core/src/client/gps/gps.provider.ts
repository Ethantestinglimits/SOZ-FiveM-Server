import { Once, OnceStep, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { PlayerUpdate } from '../../core/decorators/player';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { wait } from '../../core/utils';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { DEFAULT_GPS_COLOR, getGpsColor, GPS_COLORS, GpsPoint, GpsVehiclePoint } from '../../shared/gps';
import { MinimapPoint, MinimapRoute } from '../../shared/nui/minimap';
import { PlayerData } from '../../shared/player';
import { PauseMinimapProvider } from '../pause/minimap.provider';
import { PauseSettingsRegistry } from '../pause/pause.settings.registry';
import { PlayerService } from '../player/player.service';

const SOURCE = 'gps-vehicle';
const WAYPOINT_BLIP_SPRITE = 8;
const SECONDARY_SLOT = 1;
const ROUTE_TIMEOUT = 1500;
const ROUTE_PAUSE = 1500;
const SLOT_SETTLE = 150;
const SAMPLE_STEP = 20;
const MAX_SAMPLES = 400;
const ARRIVAL_RADIUS = { ground: 30, boat: 50, air: 120 };

@Provider()
export class GpsProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(PauseMinimapProvider)
    private pauseMinimapProvider: PauseMinimapProvider;

    @Inject(PauseSettingsRegistry)
    private pauseSettingsRegistry: PauseSettingsRegistry;

    private colorId = DEFAULT_GPS_COLOR;

    private syncKey = '';

    private vehicleNetId: number | null = null;

    private points: GpsVehiclePoint[] = [];

    private routes = new Map<number, MinimapPoint[]>();

    private reached = new Set<number>();

    private running = true;

    @Once(OnceStep.Start)
    public registerSetting(): void {
        this.pauseSettingsRegistry.register('gpsColor', {
            get: () => this.colorId,
            apply: value => {
                const color = GPS_COLORS.find(item => item.id === value);

                if (!color) {
                    return;
                }

                this.setColor(color.id);
                TriggerServerEvent('QBCore:Server:SetMetaData', 'gpscolor', color.id);
            },
        });
    }

    @Once(OnceStep.PlayerLoaded)
    public async startRoutes(): Promise<void> {
        while (this.running) {
            if (this.points.length === 0) {
                await wait(1000);
                continue;
            }

            for (const point of [...this.points]) {
                if (!this.points.includes(point)) {
                    continue;
                }

                if (GetPosAlongGpsTypeRoute(true, SAMPLE_STEP, SECONDARY_SLOT)[0]) {
                    continue;
                }

                if (!this.pauseMinimapProvider.reserveSecondarySlot()) {
                    continue;
                }

                const route = await this.computeRoute(point);

                await wait(SLOT_SETTLE);
                this.pauseMinimapProvider.releaseSecondarySlot();

                if (route && this.points.includes(point)) {
                    this.routes.set(point.author, route);
                    this.dispatch();
                }
            }

            await wait(ROUTE_PAUSE);
        }
    }

    @PlayerUpdate()
    public onPlayerUpdate(player: PlayerData): void {
        const next = getGpsColor(player.metadata.gpscolor).id;

        if (next !== this.colorId) {
            this.setColor(next);
        }
    }

    @Tick(500)
    public sync(): void {
        const ped = PlayerPedId();
        const vehicle = GetVehiclePedIsIn(ped, false);
        const shared =
            vehicle !== 0 &&
            GetVehicleModelNumberOfSeats(GetEntityModel(vehicle)) > 1 &&
            NetworkGetEntityIsNetworked(vehicle);
        const netId = shared ? VehToNet(vehicle) : null;
        let point: GpsPoint | null = null;

        if (IsWaypointActive()) {
            const [x, y] = GetBlipInfoIdCoord(GetFirstBlipInfoId(WAYPOINT_BLIP_SPRITE));

            point = { x, y };
        }

        const key = `${netId}:${this.colorId}:${point ? `${Math.round(point.x)}:${Math.round(point.y)}` : ''}`;

        if (key !== this.syncKey) {
            this.syncKey = key;
            this.vehicleNetId = netId;
            TriggerServerEvent(ServerEvent.GPS_VEHICLE_SYNC, netId, point);
        }

        if (netId !== null && GetPedInVehicleSeat(vehicle, -1) === ped) {
            this.checkArrival(vehicle, netId);
        }
    }

    @OnEvent(ClientEvent.GPS_VEHICLE_POINTS)
    public onPoints(points: GpsVehiclePoint[]): void {
        const self = GetPlayerServerId(PlayerId());

        this.points = points.filter(point => point.author !== self);

        const authors = new Set(this.points.map(point => point.author));

        for (const author of [...this.routes.keys()]) {
            if (!authors.has(author)) {
                this.routes.delete(author);
            }
        }

        for (const author of [...this.reached]) {
            if (!authors.has(author)) {
                this.reached.delete(author);
            }
        }

        this.dispatch();
    }

    private setColor(id: string): void {
        this.colorId = id;
        this.pauseMinimapProvider.setWaypointColor(getGpsColor(id).hex);
    }

    private dispatch(): void {
        this.pauseMinimapProvider.setMarkers(
            SOURCE,
            this.points.map(point => ({
                id: `${SOURCE}-${point.author}`,
                x: point.x,
                y: point.y,
                color: point.color,
                label: point.name,
            }))
        );

        const routes: MinimapRoute[] = [];

        for (const point of this.points) {
            const route = this.routes.get(point.author);

            if (route && route.length > 1) {
                routes.push({ id: `${SOURCE}-${point.author}`, color: point.color, points: route });
            }
        }

        this.pauseMinimapProvider.setRoutes(SOURCE, routes);
    }

    private checkArrival(vehicle: number, netId: number): void {
        const model = GetEntityModel(vehicle);
        const radius =
            IsThisModelAHeli(model) || IsThisModelAPlane(model)
                ? ARRIVAL_RADIUS.air
                : IsThisModelABoat(model)
                  ? ARRIVAL_RADIUS.boat
                  : ARRIVAL_RADIUS.ground;
        const [x, y] = GetEntityCoords(vehicle, false);

        for (const point of this.points) {
            if (!this.reached.has(point.author) && Math.hypot(point.x - x, point.y - y) < radius) {
                this.reached.add(point.author);
                TriggerServerEvent(ServerEvent.GPS_VEHICLE_REACHED, netId, point.author);
            }
        }
    }

    private async computeRoute(point: GpsVehiclePoint): Promise<MinimapPoint[] | null> {
        const blip = AddBlipForCoord(point.x, point.y, 0);

        SetBlipDisplay(blip, 0);
        SetBlipRoute(blip, true);

        try {
            const start = GetGameTimer();

            while (!GetPosAlongGpsTypeRoute(true, SAMPLE_STEP, SECONDARY_SLOT)[0]) {
                if (GetGameTimer() - start > ROUTE_TIMEOUT) {
                    return null;
                }

                await wait(0);
            }

            const route: MinimapPoint[] = [];

            for (let sample = 0; sample < MAX_SAMPLES; sample++) {
                const [found, position] = GetPosAlongGpsTypeRoute(true, sample * SAMPLE_STEP, SECONDARY_SLOT);

                if (!found) {
                    break;
                }

                const previous = route[route.length - 1];

                if (previous && Math.hypot(position[0] - previous.x, position[1] - previous.y) < 0.5) {
                    break;
                }

                route.push({ x: position[0], y: position[1] });
            }

            route.push({ x: point.x, y: point.y });

            return route;
        } finally {
            SetBlipRoute(blip, false);
            RemoveBlip(blip);
        }
    }
}
