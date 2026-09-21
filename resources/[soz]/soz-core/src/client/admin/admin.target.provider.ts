import { Once, OnceStep } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { TargetOption } from '@public/shared/target';

import { SceneProvider } from '../scene/scene.provider';
import { TargetProvider } from '../target/target.provider';
import { AdminMenuVehicleProvider } from './admin.menu.vehicle.provider';
import { AdminPermissionService } from './admin.permission.service';

const GROUP_PLACE = 'Placer';

/**
 * Menu contextuel admin quand on clique sur le sol (ou un élément sans option): placer un véhicule, des props...
 */
@Provider()
export class AdminTargetProvider {
    @Inject(TargetProvider)
    private targetProvider: TargetProvider;

    @Inject(AdminPermissionService)
    private adminPermissionService: AdminPermissionService;

    @Inject(AdminMenuVehicleProvider)
    private adminMenuVehicleProvider: AdminMenuVehicleProvider;

    @Inject(SceneProvider)
    private sceneProvider: SceneProvider;

    @Once(OnceStep.Start)
    public onStart(): void {
        this.targetProvider.registerWorldOptions(async coords => {
            const permission = await this.adminPermissionService.getPermission();

            if (!this.adminPermissionService.hasLevel(permission, 'any')) {
                return [];
            }

            const place = (label: string, action: TargetOption['action']): TargetOption => ({
                label,
                action,
                category: 'citizen',
                group: GROUP_PLACE,
            });

            return [
                place('Voiture', () => this.adminMenuVehicleProvider.spawnVehicleAt(coords)),
                // Le menu de placement de props (collections de props), le même que celui du marteau
                place('Props', () => this.sceneProvider.openPlacementMenu()),
            ];
        });
    }
}
