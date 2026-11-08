import { On, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { getGpsColor, GPS_COLORS, GpsPoint, GpsVehiclePoint } from '../../shared/gps';
import { PlayerService } from '../player/player.service';

type VehicleState = {
    occupants: Set<number>;
    points: Map<number, GpsVehiclePoint>;
};

const MOVE_THRESHOLD = 1;

@Provider()
export class GpsVehicleProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    private vehicles = new Map<number, VehicleState>();

    private playerVehicles = new Map<number, number>();

    @OnEvent(ServerEvent.GPS_VEHICLE_SYNC)
    public onSync(source: number, netId: number | null, point: GpsPoint | null): void {
        const previous = this.playerVehicles.get(source);
        const touched = new Set<number>();

        if (previous !== undefined && previous !== netId) {
            this.leave(source, previous);
            touched.add(previous);
            TriggerClientEvent(ClientEvent.GPS_VEHICLE_POINTS, source, []);
        }

        if (typeof netId === 'number') {
            const vehicle = this.join(source, netId);

            touched.add(netId);
            this.updatePoint(source, vehicle, point);
        }

        touched.forEach(id => this.push(id));
    }

    @OnEvent(ServerEvent.GPS_VEHICLE_REACHED)
    public onReached(source: number, netId: number, author: number): void {
        const vehicle = this.vehicles.get(netId);

        if (!vehicle || this.playerVehicles.get(source) !== netId || !vehicle.points.delete(author)) {
            return;
        }

        this.push(netId);
    }

    @On('playerDropped')
    public onDropped(source: number): void {
        const previous = this.playerVehicles.get(source);

        if (previous !== undefined) {
            this.leave(source, previous);
            this.push(previous);
        }
    }

    private join(source: number, netId: number): VehicleState {
        let vehicle = this.vehicles.get(netId);

        if (!vehicle) {
            vehicle = { occupants: new Set(), points: new Map() };
            this.vehicles.set(netId, vehicle);
        }

        vehicle.occupants.add(source);
        this.playerVehicles.set(source, netId);

        return vehicle;
    }

    private leave(source: number, netId: number): void {
        this.playerVehicles.delete(source);

        const vehicle = this.vehicles.get(netId);

        if (!vehicle) {
            return;
        }

        vehicle.occupants.delete(source);

        if (vehicle.occupants.size === 0) {
            this.vehicles.delete(netId);
        }
    }

    private updatePoint(source: number, vehicle: VehicleState, point: GpsPoint | null): void {
        const current = vehicle.points.get(source);

        if (!point) {
            vehicle.points.delete(source);

            return;
        }

        const player = this.playerService.getPlayer(source);
        const color = this.freeColor(vehicle, source, getGpsColor(player?.metadata.gpscolor).hex);
        const name = player ? `${player.charinfo.firstname} ${player.charinfo.lastname}` : '';

        if (
            current &&
            current.color === color &&
            Math.hypot(current.x - point.x, current.y - point.y) < MOVE_THRESHOLD
        ) {
            return;
        }

        vehicle.points.set(source, { author: source, name, x: point.x, y: point.y, color });
    }

    private freeColor(vehicle: VehicleState, author: number, preferred: string): string {
        const used = new Set(
            [...vehicle.points.values()].filter(point => point.author !== author).map(point => point.color)
        );

        if (!used.has(preferred)) {
            return preferred;
        }

        const start = GPS_COLORS.findIndex(color => color.hex === preferred);

        for (let offset = 1; offset <= GPS_COLORS.length; offset++) {
            const candidate = GPS_COLORS[(start + offset) % GPS_COLORS.length].hex;

            if (!used.has(candidate)) {
                return candidate;
            }
        }

        return preferred;
    }

    private push(netId: number): void {
        const vehicle = this.vehicles.get(netId);

        if (!vehicle) {
            return;
        }

        const points = [...vehicle.points.values()];

        vehicle.occupants.forEach(occupant => TriggerClientEvent(ClientEvent.GPS_VEHICLE_POINTS, occupant, points));
    }
}
