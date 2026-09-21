import { Once, OnceStep } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { ContextMenuEntry, WorldContextMenu } from '@public/config/context-menu';
import { TargetOption } from '@public/shared/target';

import { SceneProvider } from '../scene/scene.provider';
import { buildContextMenu } from '../target/context-menu';
import { TargetProvider } from '../target/target.provider';
import { AdminMenuVehicleProvider } from './admin.menu.vehicle.provider';
import { AdminPermissionService } from './admin.permission.service';

/**
 * Menu contextuel admin quand on clique sur le sol (ou un élément sans option): placer un véhicule, des props...
 * La place, le nom et le rôle de chaque entrée sont dans config/context-menu.ts (WorldContextMenu).
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
            const options: TargetOption[] = [];

            const add = (entry: ContextMenuEntry, action: TargetOption['action']) => {
                if (!this.adminPermissionService.hasLevel(permission, entry.level ?? 'any')) return;

                options.push({
                    label: entry.label ?? entry.id,
                    group: entry.group,
                    category: 'citizen',
                    action,
                    order: String(options.length).padStart(3, '0'),
                });
            };

            buildContextMenu('sol', WorldContextMenu, {
                placeVehicle: entry => add(entry, () => this.adminMenuVehicleProvider.spawnVehicleAt(coords)),
                // Le menu de placement de props (collections de props), le même que celui du marteau
                placeProps: entry => add(entry, () => this.sceneProvider.openPlacementMenu()),
            });

            return options;
        });
    }
}
