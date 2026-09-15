import { Once, OnceStep } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { ServerEvent } from '../../shared/event';
import { validateCustomPlate } from '../../shared/vehicle/plate';
import { InputService } from '../nui/input.service';
import { TargetFactory } from '../target/target.factory';

@Provider()
export class VehicleItemProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(InputService)
    private inputService: InputService;

    @Once(OnceStep.PlayerLoaded)
    public async setupVehicleItems() {
        this.targetFactory.createForAllVehicle([
            {
                icon: 'mechanic/nettoyer',
                label: 'Laver (kit)',
                item: 'cleaningkit',
                category: 'society',
                action: entity => {
                    const networkId = NetworkGetNetworkIdFromEntity(entity);

                    TriggerServerEvent(ServerEvent.VEHICLE_USE_CLEANING_KIT, networkId);
                },
                canInteract: () => {
                    return true;
                },
            },
            {
                icon: 'mechanic/reparer_mecanique',
                label: 'Réparer mécanique (kit)',
                item: 'repairkit',
                category: 'society',
                action: entity => {
                    const networkId = NetworkGetNetworkIdFromEntity(entity);

                    TriggerServerEvent(ServerEvent.VEHICLE_USE_REPAIR_KIT, networkId);
                },
                canInteract: () => {
                    return true;
                },
            },
            {
                icon: 'mechanic/reparer_carosserie',
                label: 'Réparer carosserie (kit)',
                item: 'bodyrepairkit',
                category: 'society',
                action: entity => {
                    const networkId = NetworkGetNetworkIdFromEntity(entity);

                    TriggerServerEvent(ServerEvent.VEHICLE_USE_BODY_REPAIR_KIT, networkId);
                },
                canInteract: () => {
                    return true;
                },
            },
            {
                icon: 'mechanic/repair_wheel',
                label: 'Anti crevaison (kit)',
                item: 'wheel_kit',
                category: 'society',
                action: entity => {
                    const networkId = NetworkGetNetworkIdFromEntity(entity);

                    TriggerServerEvent(ServerEvent.VEHICLE_USE_WHEEL_KIT, networkId);
                },
                canInteract: () => {
                    return true;
                },
            },
            {
                icon: 'crimi/plaque',
                label: 'Poser une plaque personnalisée',
                item: 'plaque_perso_temp',
                category: 'criminal',
                action: async entity => {
                    const plate = await this.inputService.askInput(
                        { title: 'Nouvelle plaque (2 à 8 caractères)', maxCharacters: 8 },
                        validateCustomPlate
                    );

                    if (!plate) {
                        return;
                    }

                    const networkId = NetworkGetNetworkIdFromEntity(entity);

                    TriggerServerEvent(ServerEvent.CUSTOM_PLATE_APPLY_FAKE, networkId, plate);
                },
                canInteract: () => {
                    return true;
                },
            },
        ]);
    }
}
