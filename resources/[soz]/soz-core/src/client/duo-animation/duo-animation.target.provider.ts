import { Once } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { MenuType } from '../../shared/nui/menu';
import { Vector3 } from '../../shared/polyzone/vector';
import { NuiMenu } from '../nui/nui.menu';
import { PlayerListStateService } from '../player/player.list.state.service';
import { TargetFactory } from '../target/target.factory';
import { DuoAnimationProvider } from './duo-animation.provider';

@Provider()
export class DuoAnimationTargetProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(NuiMenu)
    private nuiMenu: NuiMenu;

    @Inject(DuoAnimationProvider)
    private duoAnimationProvider: DuoAnimationProvider;

    @Inject(PlayerListStateService)
    private playerListStateService: PlayerListStateService;

    @Once()
    public onStart() {
        this.targetFactory.createForAllPlayer([
            {
                label: 'Animation',
                icon: 'pet/cuddle',
                category: 'citizen',
                canInteract: entity => {
                    const targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(entity));

                    return (
                        !this.duoAnimationProvider.isBusy() &&
                        !IsEntityDead(entity) &&
                        !this.playerListStateService.isDead(targetServerId) &&
                        !this.playerListStateService.isInLastStand(targetServerId) &&
                        !IsPedInAnyVehicle(entity, true) &&
                        !IsPedInAnyVehicle(PlayerPedId(), true) &&
                        !IsPedRagdoll(entity) &&
                        !IsPedRagdoll(PlayerPedId()) &&
                        !IsPedSwimming(entity) &&
                        !IsPedSwimming(PlayerPedId())
                    );
                },
                action: entity => {
                    const targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(entity));

                    this.nuiMenu.openMenu(
                        MenuType.DuoAnimation,
                        { targetServerId },
                        {
                            position: {
                                position: () => GetEntityCoords(entity) as Vector3,
                                distance: 3,
                            },
                        }
                    );
                },
            },
        ]);
    }
}
