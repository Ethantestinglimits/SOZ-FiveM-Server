import { On, OnEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { Tick, TickInterval } from '@core/decorators/tick';
import { GpsColors } from '@public/config/gps';
import { ClientEvent, ServerEvent } from '@public/shared/event';
import { findGpsColor, GpsPointPosition, VehicleGpsPoint } from '@public/shared/gps';

import { PlayerService } from '../player/player.service';

const isGpsPointPosition = (position: unknown): position is GpsPointPosition =>
    Array.isArray(position) && position.length === 2 && position.every(value => Number.isFinite(value));

@Provider()
export class GpsVehiclePointProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    private personalPoints = new Map<number, GpsPointPosition>();

    private playerVehicles = new Map<number, number>();

    private vehiclePoints = new Map<number, Map<number, VehicleGpsPoint>>();

    @OnEvent(ServerEvent.GPS_SET_PERSONAL_POINT)
    public onSetPersonalPoint(source: number, position: unknown): void {
        if (isGpsPointPosition(position)) {
            this.personalPoints.set(source, [position[0], position[1]]);
        } else {
            this.personalPoints.delete(source);
        }

        const vehicleNetworkId = this.playerVehicles.get(source);

        if (vehicleNetworkId === undefined) {
            return;
        }

        this.shareAuthorPoint(vehicleNetworkId, source);
        this.pushVehiclePoints(vehicleNetworkId);
    }

    @OnEvent(ServerEvent.GPS_VEHICLE_POINT_REACHED)
    public onVehiclePointReached(source: number, author: unknown): void {
        if (typeof author !== 'number') {
            return;
        }

        const vehicleNetworkId = this.playerVehicles.get(source);

        if (vehicleNetworkId === undefined) {
            return;
        }

        this.removeAuthorPoint(vehicleNetworkId, author);
        this.pushVehiclePoints(vehicleNetworkId);
    }

    @OnEvent(ServerEvent.BASE_ENTERED_VEHICLE)
    public onEnteredVehicle(source: number, vehicleNetworkId: number): void {
        if (this.playerVehicles.get(source) === vehicleNetworkId) {
            return;
        }

        this.leaveVehicle(source);
        this.playerVehicles.set(source, vehicleNetworkId);

        if (this.personalPoints.has(source)) {
            this.shareAuthorPoint(vehicleNetworkId, source);
        }

        this.pushVehiclePoints(vehicleNetworkId);
    }

    @OnEvent(ServerEvent.BASE_LEFT_VEHICLE)
    public onLeftVehicle(source: number): void {
        this.leaveVehicle(source);
    }

    @On('playerDropped')
    public onPlayerDropped(source: number): void {
        this.leaveVehicle(source);
        this.personalPoints.delete(source);
    }

    @Tick(TickInterval.EVERY_SECOND, 'gps:vehicle-point:despawn-check')
    public checkDespawnedVehicles(): void {
        for (const vehicleNetworkId of this.vehiclePoints.keys()) {
            const entityId = NetworkGetEntityFromNetworkId(vehicleNetworkId);

            if (entityId && DoesEntityExist(entityId)) {
                continue;
            }

            this.clearVehicle(vehicleNetworkId);
        }
    }

    private clearVehicle(vehicleNetworkId: number): void {
        this.vehiclePoints.delete(vehicleNetworkId);

        for (const [occupant, occupantVehicleNetworkId] of this.playerVehicles) {
            if (occupantVehicleNetworkId !== vehicleNetworkId) {
                continue;
            }

            this.playerVehicles.delete(occupant);
            TriggerClientEvent(ClientEvent.GPS_SET_VEHICLE_POINTS, occupant, []);
        }
    }

    private leaveVehicle(source: number): void {
        const vehicleNetworkId = this.playerVehicles.get(source);

        if (vehicleNetworkId === undefined) {
            return;
        }

        this.playerVehicles.delete(source);
        TriggerClientEvent(ClientEvent.GPS_SET_VEHICLE_POINTS, source, []);

        if (!this.hasOccupants(vehicleNetworkId)) {
            this.vehiclePoints.delete(vehicleNetworkId);

            return;
        }

        this.pushVehiclePoints(vehicleNetworkId);
    }

    private hasOccupants(vehicleNetworkId: number): boolean {
        for (const occupantVehicleNetworkId of this.playerVehicles.values()) {
            if (occupantVehicleNetworkId === vehicleNetworkId) {
                return true;
            }
        }

        return false;
    }

    private shareAuthorPoint(vehicleNetworkId: number, author: number): void {
        const position = this.personalPoints.get(author);

        if (!position) {
            this.removeAuthorPoint(vehicleNetworkId, author);

            return;
        }

        const points = this.vehiclePoints.get(vehicleNetworkId) ?? new Map<number, VehicleGpsPoint>();
        const player = this.playerService.getPlayer(author);
        const preferredBlipColor = findGpsColor(player?.metadata.gpscolor).blipColor;

        points.set(author, {
            author,
            position,
            blipColor: this.resolveFreeBlipColor(points, author, preferredBlipColor),
        });

        this.vehiclePoints.set(vehicleNetworkId, points);
    }

    private resolveFreeBlipColor(
        points: Map<number, VehicleGpsPoint>,
        author: number,
        preferredBlipColor: number
    ): number {
        const usedBlipColors = new Set<number>();

        for (const [pointAuthor, point] of points) {
            if (pointAuthor !== author) {
                usedBlipColors.add(point.blipColor);
            }
        }

        if (!usedBlipColors.has(preferredBlipColor)) {
            return preferredBlipColor;
        }

        const preferredIndex = GpsColors.findIndex(gpsColor => gpsColor.blipColor === preferredBlipColor);
        const startIndex = preferredIndex === -1 ? 0 : preferredIndex;

        for (let offset = 1; offset <= GpsColors.length; offset++) {
            const candidate = GpsColors[(startIndex + offset) % GpsColors.length];

            if (!usedBlipColors.has(candidate.blipColor)) {
                return candidate.blipColor;
            }
        }

        return preferredBlipColor;
    }

    private removeAuthorPoint(vehicleNetworkId: number, author: number): void {
        const points = this.vehiclePoints.get(vehicleNetworkId);

        if (!points) {
            return;
        }

        points.delete(author);

        if (points.size === 0) {
            this.vehiclePoints.delete(vehicleNetworkId);
        }
    }

    private pushVehiclePoints(vehicleNetworkId: number): void {
        const points = Array.from(this.vehiclePoints.get(vehicleNetworkId)?.values() ?? []);

        for (const [occupant, occupantVehicleNetworkId] of this.playerVehicles) {
            if (occupantVehicleNetworkId !== vehicleNetworkId) {
                continue;
            }

            TriggerClientEvent(
                ClientEvent.GPS_SET_VEHICLE_POINTS,
                occupant,
                points.filter(point => point.author !== occupant)
            );
        }
    }
}
