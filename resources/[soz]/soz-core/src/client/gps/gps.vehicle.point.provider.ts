import { Once, OnceStep, OnEvent, OnNuiEvent } from '@core/decorators/event';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { ClientEvent, NuiEvent, ServerEvent } from '@public/shared/event';
import { GpsPointPosition, isSameGpsPointPosition, VehicleGpsPoint } from '@public/shared/gps';
import { getDistance, Vector3 } from '@public/shared/polyzone/vector';

const WAYPOINT_BLIP_SPRITE = 8;
const VEHICLE_POINT_BLIP_SPRITE = 1;
const VEHICLE_POINT_ARRIVAL_RADIUS = 20.0;

type VehicleGpsPointBlip = {
    blip: number;
    point: VehicleGpsPoint;
};

@Provider()
export class GpsVehiclePointProvider {
    private personalPoint: GpsPointPosition | null = null;

    private blips = new Map<number, VehicleGpsPointBlip>();

    private reachedAuthors = new Set<number>();

    @Once(OnceStep.Stop)
    public onStop(): void {
        for (const { blip } of this.blips.values()) {
            RemoveBlip(blip);
        }

        this.blips.clear();
    }

    @Tick(500, 'gps:personal-point:check')
    public checkPersonalPoint(): void {
        const position = this.getPersonalPoint();

        if (isSameGpsPointPosition(position, this.personalPoint)) {
            return;
        }

        if (this.blips.size > 0) {
            return;
        }

        this.personalPoint = position;
        TriggerServerEvent(ServerEvent.GPS_SET_PERSONAL_POINT, position);
    }

    @OnEvent(ClientEvent.GPS_EXPLICIT_PERSONAL_POINT, false)
    public setExplicitPersonalPoint(position: GpsPointPosition | null): void {
        this.personalPoint = position;
        TriggerServerEvent(ServerEvent.GPS_SET_PERSONAL_POINT, position);
    }

    @OnNuiEvent(NuiEvent.PlayerMenuGpsSetPersonalPointHere)
    public async setPersonalPointHere(): Promise<void> {
        const [x, y] = GetEntityCoords(PlayerPedId(), true) as Vector3;

        SetNewWaypoint(x, y);
        this.setExplicitPersonalPoint([x, y]);
    }

    @OnNuiEvent(NuiEvent.PlayerMenuGpsClearPersonalPoint)
    public async clearPersonalPoint(): Promise<void> {
        DeleteWaypoint();
        this.setExplicitPersonalPoint(null);
    }

    @Tick(500, 'gps:vehicle-point:check-arrival')
    public checkVehiclePointArrival(): void {
        if (this.blips.size === 0) {
            return;
        }

        const ped = PlayerPedId();
        const vehicle = GetVehiclePedIsIn(ped, false);

        if (!vehicle) {
            return;
        }

        const position = GetEntityCoords(vehicle, true) as Vector3;

        for (const [author, { point }] of this.blips) {
            if (this.reachedAuthors.has(author)) {
                continue;
            }

            if (getDistance(position, point.position) <= VEHICLE_POINT_ARRIVAL_RADIUS) {
                this.reachedAuthors.add(author);
                TriggerServerEvent(ServerEvent.GPS_VEHICLE_POINT_REACHED, author);
            }
        }
    }

    @OnEvent(ClientEvent.GPS_SET_VEHICLE_POINTS)
    public setVehiclePoints(points: VehicleGpsPoint[]): void {
        const authors = new Set(points.map(point => point.author));

        for (const [author, { blip }] of this.blips) {
            if (!authors.has(author)) {
                RemoveBlip(blip);
                this.blips.delete(author);
                this.reachedAuthors.delete(author);
            }
        }

        for (const point of points) {
            const current = this.blips.get(point.author);

            if (
                current &&
                current.point.blipColor === point.blipColor &&
                isSameGpsPointPosition(current.point.position, point.position)
            ) {
                continue;
            }

            if (current) {
                RemoveBlip(current.blip);
            }

            this.blips.set(point.author, { blip: this.createBlip(point), point });
        }
    }

    private getPersonalPoint(): GpsPointPosition | null {
        if (!IsWaypointActive()) {
            return null;
        }

        const ownBlips = new Set(Array.from(this.blips.values(), ({ blip }) => blip));

        for (
            let blip = GetFirstBlipInfoId(WAYPOINT_BLIP_SPRITE);
            DoesBlipExist(blip);
            blip = GetNextBlipInfoId(WAYPOINT_BLIP_SPRITE)
        ) {
            if (ownBlips.has(blip)) {
                continue;
            }

            const [x, y] = GetBlipInfoIdCoord(blip);

            return [x, y];
        }

        return null;
    }

    private createBlip(point: VehicleGpsPoint): number {
        const [x, y] = point.position;
        const blip = AddBlipForCoord(x, y, 0.0);

        SetBlipSprite(blip, VEHICLE_POINT_BLIP_SPRITE);
        SetBlipColour(blip, point.blipColor);
        SetBlipRoute(blip, true);
        SetBlipRouteColour(blip, point.blipColor);
        BeginTextCommandSetBlipName('STRING');
        AddTextComponentSubstringPlayerName('Point de véhicule');
        EndTextCommandSetBlipName(blip);

        return blip;
    }
}
