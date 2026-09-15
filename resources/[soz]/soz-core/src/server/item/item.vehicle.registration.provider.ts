import { Once } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { ClientEvent } from '@public/shared/event';
import { InventoryItem } from '@public/shared/inventory';

import { ItemService } from './item.service';

@Provider()
export class ItemVehicleRegistrationProvider {
    @Inject(ItemService)
    private item: ItemService;

    @Once()
    public onInit() {
        this.item.setItemShowCallback('carte_grise', this.showRegistrationCard.bind(this));
    }

    private showRegistrationCard(source: number, target: number, inventoryItem: InventoryItem) {
        TriggerClientEvent(
            ClientEvent.VEHICLE_REGISTRATION_SHOW_CARD,
            target,
            inventoryItem.metadata?.vehiclePlate,
            inventoryItem.metadata?.vehicleModel,
            inventoryItem.metadata?.vehicleOwnerName
        );
    }
}
