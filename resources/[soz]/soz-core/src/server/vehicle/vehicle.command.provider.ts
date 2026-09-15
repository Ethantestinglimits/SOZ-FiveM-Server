import { Command } from '../../core/decorators/command';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Logger } from '../../core/logger';
import { ClientEvent } from '../../shared/event';
import { Notifier } from '../notifier';
import { VehicleSpawner } from './vehicle.spawner';
import { VehicleStateService } from './vehicle.state.service';

@Provider()
export class VehicleCommandProvider {
    @Inject(VehicleSpawner)
    private vehicleSpawner: VehicleSpawner;

    @Inject(VehicleStateService)
    private vehicleStateService: VehicleStateService;

    @Inject(Notifier)
    private notifier: Notifier;

    @Inject(Logger)
    private logger: Logger;

    @Command('car', { role: ['staff', 'admin', 'gamemaster'], description: 'Spawn Vehicle (Admin Only)' })
    async createCarCommand(source: number, model: string) {
        const spawned = await this.vehicleSpawner.spawnTemporaryVehicle(source, model);

        if (!spawned) {
            this.logger.error(`Vehicle ${model} could not be spawned`);
        }
    }
    @Command('dv', { role: ['staff', 'admin', 'helper'], description: 'Delete Vehicle (Admin Only)' })
    async deleteCarCommand(source: number) {
        const closestVehicle = await this.vehicleSpawner.getClosestVehicle(source);

        if (closestVehicle !== null) {
            await this.vehicleSpawner.delete(closestVehicle.vehicleNetworkId);
        }
    }

    @Command('dirty', { role: ['admin'], description: 'Set vehicle dirty (Admin Only)' })
    async dirtyCommand(source: number) {
        const closestVehicle = await this.vehicleSpawner.getClosestVehicle(source);

        this.vehicleStateService.updateVehicleCondition(closestVehicle.vehicleNetworkId, {
            dirtLevel: 15.0,
        });
    }

    @Command('fuel', { role: ['admin'], description: 'Set fuel level (Admin Only)' })
    async fuelCommand(source: number, newlevel: number) {
        const closestVehicle = await this.vehicleSpawner.getClosestVehicle(source);

        this.vehicleStateService.updateVehicleCondition(closestVehicle.vehicleNetworkId, {
            fuelLevel: newlevel,
        });
    }

    @Command('oil', { role: ['admin'], description: 'Set oil level (Admin Only)' })
    async oilCommand(source: number, newlevel: number) {
        const closestVehicle = await this.vehicleSpawner.getClosestVehicle(source);

        this.vehicleStateService.updateVehicleCondition(closestVehicle.vehicleNetworkId, {
            oilLevel: newlevel,
        });
    }

    @Command('perf', { role: ['admin'], description: 'Max out closest vehicle performance (Admin Only)' })
    async perfCommand(source: number) {
        const closestVehicle = await this.vehicleSpawner.getClosestVehicle(source);

        if (!closestVehicle) {
            this.notifier.notify(source, 'Aucun véhicule à proximité.', 'error');
            return;
        }

        const entityId = NetworkGetEntityFromNetworkId(closestVehicle.vehicleNetworkId);

        if (!entityId) {
            this.notifier.notify(source, 'Ce véhicule est introuvable.', 'error');
            return;
        }

        const owner = NetworkGetEntityOwner(entityId);

        if (!owner) {
            this.notifier.notify(source, "Ce véhicule n'a pas de propriétaire réseau.", 'error');
            return;
        }

        TriggerClientEvent(ClientEvent.VEHICLE_ADMIN_MAX_PERFORMANCE, owner, closestVehicle.vehicleNetworkId);
    }
}
