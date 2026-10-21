import { Once, OnceStep, OnEvent } from '@core/decorators/event';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { ClientEvent, ServerEvent } from '@public/shared/event';
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
        let position = this.getPersonalPoint();

        if (position && this.isSomeoneElsesVehiclePoint(position)) {
            position = null;
        }

        if (isSameGpsPointPosition(position, this.personalPoint)) {
            return;
        }

        this.personalPoint = position;
        TriggerServerEvent(ServerEvent.GPS_SET_PERSONAL_POINT, position);
    }

    private isSomeoneElsesVehiclePoint(position: GpsPointPosition): boolean {
        for (const { point } of this.blips.values()) {
            if (isSameGpsPointPosition(position, point.position)) {
                return true;
            }
        }

        return false;
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

        const blip = GetFirstBlipInfoId(WAYPOINT_BLIP_SPRITE);

        if (!DoesBlipExist(blip)) {
            return null;
        }

        const [x, y] = GetBlipInfoIdCoord(blip);

        return [x, y];
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
