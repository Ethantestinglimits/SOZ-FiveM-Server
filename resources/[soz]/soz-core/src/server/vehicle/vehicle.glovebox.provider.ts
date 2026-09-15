import { OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { GLOVEBOX_EXPLOSIVE_ITEMS } from '../../shared/inventory';
import { Vector3 } from '../../shared/polyzone/vector';
import { InventoryFactory } from '../inventory/inventory.factory';
import { VehicleStateService } from './vehicle.state.service';

@Provider()
export class VehicleGloveboxProvider {
    @Inject(InventoryFactory)
    private inventoryFactory: InventoryFactory;

    @Inject(VehicleStateService)
    private vehicleStateService: VehicleStateService;

    @OnEvent(ServerEvent.VEHICLE_CHECK_GLOVEBOX_EXPLOSIVE)
    public async onCheckGloveboxExplosive(source: number, vehicleNetworkId: number) {
        const vehicle = NetworkGetEntityFromNetworkId(vehicleNetworkId) as number;

        if (!vehicle || !DoesEntityExist(vehicle)) {
            return;
        }

        const vehicleState = this.vehicleStateService.getVehicleState(vehicleNetworkId);
        const plate = vehicleState.volatile.plate || GetVehicleNumberPlateText(vehicle);
        const inventory = await this.inventoryFactory.get(`glovebox_${plate}`, true);

        if (!inventory) {
            return;
        }

        const hasExplosive = inventory.findItem(item => GLOVEBOX_EXPLOSIVE_ITEMS.includes(item.name));

        if (!hasExplosive) {
            return;
        }

        // Clearing the glovebox first makes this idempotent: a chaotic crash can fire this
        // event more than once, but only the first call still finds an explosive to react to.
        inventory.clear();

        // The trunk doesn't survive the car blowing up either.
        const trunkInventory = await this.inventoryFactory.get(`trunk_${plate}`, true);
        trunkInventory?.clear();

        const position = GetEntityCoords(vehicle, false) as Vector3;
        TriggerEvent(ServerEvent.POLICE_VEHICLE_EXPLOSIVE_DETONATION, plate, position);

        // The explosion natives are client-only; delegate to the player who reported the
        // crash — they had network control of the vehicle when this event was sent, which is
        // more reliable right after a violent impact than re-resolving NetworkGetEntityOwner
        // server-side (ownership can be mid-handover at that exact moment).
        TriggerClientEvent(ClientEvent.VEHICLE_GLOVEBOX_EXPLODE, source, vehicleNetworkId);
    }
}
