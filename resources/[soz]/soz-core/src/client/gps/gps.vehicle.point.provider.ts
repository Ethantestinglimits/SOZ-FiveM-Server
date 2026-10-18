import { OnEvent } from '@core/decorators/event';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { ClientEvent, ServerEvent } from '@public/shared/event';
import { GpsPointPosition, isSameGpsPointPosition, VehicleGpsPoint } from '@public/shared/gps';

const WAYPOINT_BLIP_SPRITE = 8;

type VehicleGpsPointBlip = {
    blip: number;
    point: VehicleGpsPoint;
};

@Provider()
export class GpsVehiclePointProvider {
    private personalPoint: GpsPointPosition | null = null;

    private blips = new Map<number, VehicleGpsPointBlip>();

    @Tick(500, 'gps:personal-point:check')
    public checkPersonalPoint(): void {
        const position = this.getPersonalPoint();

        if (isSameGpsPointPosition(position, this.personalPoint)) {
            return;
        }

        this.personalPoint = position;
        TriggerServerEvent(ServerEvent.GPS_SET_PERSONAL_POINT, position);
    }

    @OnEvent(ClientEvent.GPS_SET_VEHICLE_POINTS)
    public setVehiclePoints(points: VehicleGpsPoint[]): void {
        const authors = new Set(points.map(point => point.author));

        for (const [author, { blip }] of this.blips) {
            if (!authors.has(author)) {
                RemoveBlip(blip);
                this.blips.delete(author);
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

        SetBlipColour(blip, point.blipColor);
        SetBlipRoute(blip, true);
        SetBlipRouteColour(blip, point.blipColor);
        BeginTextCommandSetBlipName('STRING');
        AddTextComponentSubstringPlayerName('Point de véhicule');
        EndTextCommandSetBlipName(blip);

        return blip;
    }
}
