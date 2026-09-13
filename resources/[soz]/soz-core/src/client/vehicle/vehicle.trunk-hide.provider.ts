import { Once, OnEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { emitRpc } from '@core/rpc';
import { wait } from '@core/utils';
import { AnimationRunner } from '@public/client/animation/animation.factory';
import { AnimationService } from '@public/client/animation/animation.service';
import { TargetFactory } from '@public/client/target/target.factory';

import { ClientEvent, ServerEvent } from '../../shared/event';
import { Vector3 } from '../../shared/polyzone/vector';
import { RpcServerEvent } from '../../shared/rpc';
import { Notifier } from '../notifier';
import { PlayerService } from '../player/player.service';
import { ProgressService } from '../progress.service';

const TRUNK_ANIMATION = {
    dictionary: 'mp_sleep',
    name: 'sleep_loop',
};

const TRUNK_HIDE_LABEL_DURATION = 24 * 60 * 60 * 1000;

@Provider()
export class VehicleTrunkHideProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(ProgressService)
    private progressService: ProgressService;

    @Inject(Notifier)
    private notifier: Notifier;

    private isHidden = false;
    private isBlackedOut = false;
    private isExiting = false;
    private hiddenVehicle: number | null = null;
    private animationRunner: AnimationRunner | null = null;

    @Once()
    public onInit() {
        this.targetFactory.createForBone(
            'boot',
            [
                {
                    label: 'Monter dans le coffre',
                    icon: 'vehicle/car',
                    category: 'citizen',
                    canInteract: () => {
                        if (
                            this.isHidden ||
                            !this.playerService.canDoAction() ||
                            this.progressService.isDoingAction()
                        ) {
                            return false;
                        }

                        const ped = PlayerPedId();

                        return IsPedOnFoot(ped) && !IsPedInAnyVehicle(ped, false);
                    },
                    action: entity => {
                        this.enterTrunk(entity);
                    },
                },
                {
                    label: 'Mettre dans le coffre',
                    icon: 'vehicle/car',
                    category: 'criminal',
                    canInteract: () => {
                        if (this.isHidden) {
                            return false;
                        }

                        const state = this.playerService.getState();

                        return state.isEscorting && state.escorting !== null;
                    },
                    action: entity => {
                        const state = this.playerService.getState();

                        if (!state.escorting) {
                            return;
                        }

                        const vehicleNetworkId = NetworkGetNetworkIdFromEntity(entity);
                        TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_PUT_PLAYER, state.escorting, vehicleNetworkId);
                    },
                },
                {
                    label: "Sortir quelqu'un du coffre",
                    icon: 'vehicle/car',
                    category: 'citizen',
                    canInteract: () => !this.isHidden,
                    action: entity => {
                        const vehicleNetworkId = NetworkGetNetworkIdFromEntity(entity);
                        TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_EXTRACT_PLAYER, vehicleNetworkId);
                    },
                },
            ],
            3.0
        );
    }

    private async enterTrunk(vehicle: number) {
        if (this.isHidden || !DoesEntityExist(vehicle)) {
            return;
        }

        this.isHidden = true;

        const vehicleNetworkId = NetworkGetNetworkIdFromEntity(vehicle);
        const claimed = await emitRpc<boolean>(RpcServerEvent.VEHICLE_TRUNK_CLAIM, vehicleNetworkId);

        if (!claimed) {
            this.isHidden = false;
            this.notifier.notify('Ce coffre est déjà occupé.', 'error');

            return;
        }

        this.hiddenVehicle = vehicle;

        const ped = PlayerPedId();

        FreezeEntityPosition(ped, true);
        TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, true);

        this.animationRunner = this.animationService.playAnimation(
            {
                base: {
                    dictionary: TRUNK_ANIMATION.dictionary,
                    name: TRUNK_ANIMATION.name,
                    blendInSpeed: 2.0,
                    blendOutSpeed: 2.0,
                    options: {
                        repeat: true,
                        freezeLastFrame: true,
                    },
                },
            },
            { ped }
        );

        await wait(1500);

        TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, false);

        SetEntityVisible(ped, false, false);
        SetEntityCollision(ped, false, false);
        FreezeEntityPosition(ped, false);

        const boneIndex = GetEntityBoneIndexByName(vehicle, 'boot');
        AttachEntityToEntity(
            ped,
            vehicle,
            boneIndex,
            0.0,
            -0.3,
            -0.1,
            0.0,
            0.0,
            0.0,
            false,
            false,
            false,
            false,
            2,
            true
        );

        this.isBlackedOut = true;

        await this.progressService.progress(
            'vehicleTrunkHide',
            'Vous êtes dans un coffre...',
            TRUNK_HIDE_LABEL_DURATION,
            {},
            {
                canCancel: true,
                useWhileDead: true,
                allowExistingAnimation: true,
                no_inv_busy: true,
                hideBar: true,
            }
        );

        await this.exitTrunk();
    }

    private async exitTrunk() {
        if (!this.isHidden || this.isExiting) {
            return;
        }

        this.isExiting = true;
        this.isBlackedOut = false;
        this.progressService.cancel();

        const ped = PlayerPedId();
        const vehicle = this.hiddenVehicle;
        const vehicleNetworkId = vehicle && DoesEntityExist(vehicle) ? NetworkGetNetworkIdFromEntity(vehicle) : null;

        if (vehicleNetworkId) {
            TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, true);
            TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_RELEASE, vehicleNetworkId);
        }

        if (this.animationRunner) {
            this.animationRunner.cancel();
            this.animationRunner = null;
        }

        if (IsEntityAttached(ped)) {
            DetachEntity(ped, true, false);
        }

        if (vehicle && DoesEntityExist(vehicle)) {
            const [exitX, exitY, exitZ] = GetOffsetFromEntityInWorldCoords(vehicle, 0.0, -3.0, 0.0) as Vector3;
            SetEntityCoords(ped, exitX, exitY, exitZ, false, false, false, true);
            SetEntityHeading(ped, GetEntityHeading(vehicle));
        }

        SetEntityVisible(ped, true, false);
        SetEntityCollision(ped, true, true);
        FreezeEntityPosition(ped, true);

        await wait(500);

        FreezeEntityPosition(ped, false);

        if (vehicleNetworkId) {
            await wait(1000);
            TriggerServerEvent(ServerEvent.VEHICLE_TRUNK_ENTER, vehicleNetworkId, false);
        }

        this.isHidden = false;
        this.isExiting = false;
        this.hiddenVehicle = null;
    }

    @Tick()
    private async trunkOverlayLoop() {
        if (!this.isBlackedOut) {
            return;
        }

        DrawRect(0.5, 0.5, 1.0, 1.0, 0, 0, 0, 204);
    }

    @OnEvent(ClientEvent.VEHICLE_TRUNK_FORCE_EXIT)
    public async onForceExit() {
        await this.exitTrunk();
    }

    @OnEvent(ClientEvent.VEHICLE_TRUNK_FORCE_ENTER)
    public async onForceEnter(vehicleNetworkId: number) {
        if (!NetworkDoesNetworkIdExist(vehicleNetworkId)) {
            return;
        }

        const vehicle = NetworkGetEntityFromNetworkId(vehicleNetworkId);

        if (!DoesEntityExist(vehicle)) {
            return;
        }

        await this.enterTrunk(vehicle);
    }
}
