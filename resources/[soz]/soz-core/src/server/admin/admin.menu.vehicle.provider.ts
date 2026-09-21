import { OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Rpc } from '../../core/decorators/rpc';
import { ServerEvent } from '../../shared/event';
import { JobType } from '../../shared/job';
import { Vector4 } from '../../shared/polyzone/vector';
import { RpcServerEvent } from '../../shared/rpc';
import { Vehicle } from '../../shared/vehicle/vehicle';
import { PrismaService } from '../database/prisma.service';
import { Notifier } from '../notifier';
import { PermissionService } from '../permission.service';
import { VehicleSpawner } from '../vehicle/vehicle.spawner';
import { VehicleStateService } from '../vehicle/vehicle.state.service';

@Provider()
export class AdminMenuVehicleProvider {
    @Inject(PrismaService)
    private prismaService: PrismaService;

    @Inject(VehicleSpawner)
    private vehicleSpawner: VehicleSpawner;

    @Inject(VehicleStateService)
    private vehicleStateService: VehicleStateService;

    @Inject(PermissionService)
    private permissionService: PermissionService;

    @Inject(Notifier)
    private notifier: Notifier;

    @Rpc(RpcServerEvent.ADMIN_GET_VEHICLES)
    public async getVehicles(): Promise<Vehicle[]> {
        return (await this.prismaService.vehicle.findMany())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(v => ({
                ...v,
                jobName: JSON.parse(v.jobName) as { [key in JobType]: string },
                handling: v.handling ? JSON.parse(v.handling) : null,
            }));
    }

    @OnEvent(ServerEvent.ADMIN_VEHICLE_SPAWN)
    public async spawnVehicle(source: number, model: string, position?: Vector4) {
        // Position choisie par le client (menu contextuel admin): réservée aux rôles admin, et sans téléporter le
        // joueur dans le véhicule
        if (position !== undefined && position !== null) {
            const isValidPosition =
                Array.isArray(position) && position.length === 4 && position.every(value => Number.isFinite(value));

            if (!isValidPosition || !this.permissionService.isHelper(source)) {
                return;
            }

            await this.vehicleSpawner.spawnTemporaryVehicle(source, model, position, false);

            return;
        }

        await this.vehicleSpawner.spawnTemporaryVehicle(source, model);
    }

    @OnEvent(ServerEvent.ADMIN_VEHICLE_DELETE)
    public async deleteVehicle(source: number, vehicleNetworkId?: number) {
        // Véhicule précis (ciblé depuis le menu contextuel): réservé au staff, le client ne doit pas pouvoir supprimer
        // n'importe quel véhicule
        if (typeof vehicleNetworkId === 'number') {
            if (this.permissionService.isStaff(source)) {
                await this.vehicleSpawner.delete(vehicleNetworkId);
            }

            return;
        }

        const closestVehicle = await this.vehicleSpawner.getClosestVehicle(source);

        if (closestVehicle !== null) {
            await this.vehicleSpawner.delete(closestVehicle.vehicleNetworkId);
        }
    }

    @OnEvent(ServerEvent.ADMIN_VEHICLE_NOS)
    public async addNOS(source: number, netId: number) {
        if (!this.permissionService.isGameMaster(source)) {
            return;
        }

        this.vehicleStateService.updateVehicleCondition(netId, { nitro: 3 });
        this.notifier.notify(source, '~g~3 kits NOS~s~ ont été installé sur le véhicule.');
    }
}
