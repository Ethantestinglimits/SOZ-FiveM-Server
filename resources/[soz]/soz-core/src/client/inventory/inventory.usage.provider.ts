import { Command } from '../../core/decorators/command';
import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { emitRpc } from '../../core/rpc';
import { DrivingSchoolConfig } from '../../shared/driving-school';
import { NuiEvent, ServerEvent } from '../../shared/event';
import { InventoryItem } from '../../shared/inventory';
import { AllowedTaxiModel } from '../../shared/job/cjr';
import { RpcServerEvent } from '../../shared/rpc';
import { VehicleClass, VehicleSeat } from '../../shared/vehicle/vehicle';
import { Notifier } from '../notifier';
import { PlayerService } from '../player/player.service';
import { VehicleSeatbeltProvider } from '../vehicle/vehicle.seatbelt.provider';

const VEHICLE_SEAT_SWITCH_MAX_SPEED_KMH = 70;
const VEHICLE_SEAT_SWITCH_FORBIDDEN_CLASSES = [
    VehicleClass.Utility,
    VehicleClass.Service,
    VehicleClass.Emergency,
    VehicleClass.Vans,
    VehicleClass.Commercial,
];

@Provider()
export class InventoryUsageProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(Notifier)
    private notifier: Notifier;

    @Inject(VehicleSeatbeltProvider)
    private vehicleSeatbeltProvider: VehicleSeatbeltProvider;

    @OnNuiEvent(NuiEvent.InventorySetShortcut)
    public async onInventoryActionSetShortcut({ shortcut, slot }: { shortcut: number; slot: number | null }) {
        TriggerServerEvent(ServerEvent.INVENTORY_SET_ITEM_SHORTCUT, shortcut, slot);
    }

    @OnNuiEvent(NuiEvent.InventoryMoveShortcut)
    public async onInventoryActionMoveShortcut({
        previousShortcut,
        nextShortcut,
    }: {
        previousShortcut: number;
        nextShortcut: number;
    }) {
        TriggerServerEvent(ServerEvent.INVENTORY_MOVE_ITEM_SHORTCUT, previousShortcut, nextShortcut);
    }

    @OnNuiEvent(NuiEvent.InventoryRemoveShortcut)
    public async onInventoryActionRemoveShortcut({ shortcut }: { shortcut: number }) {
        TriggerServerEvent(ServerEvent.INVENTORY_REMOVE_ITEM_SHORTCUT, shortcut);
    }

    private async useItem(shortcut: number) {
        const playerState = this.playerService.getState();
        if (playerState.isInGame) return;

        const item = await emitRpc<InventoryItem | null>(RpcServerEvent.INVENTORY_GET_ITEM_BY_SHORTCUT, shortcut);
        if (!item) {
            return;
        }

        if (playerState.isInGameHub && item.type === 'weapon') return;

        const player = this.playerService.getPlayer();

        if (!player) {
            return;
        }

        const inventoryId = `player_${player.citizenid}`;
        TriggerServerEvent(ServerEvent.INVENTORY_USE_ITEM, inventoryId, item.slot);
    }

    private getPedVehicleSeat(vehicle: number, ped: number): VehicleSeat | null {
        const maxPassengers = GetVehicleMaxNumberOfPassengers(vehicle);

        for (let seat = VehicleSeat.Driver; seat < maxPassengers; seat++) {
            if (GetPedInVehicleSeat(vehicle, seat) === ped) {
                return seat;
            }
        }

        return null;
    }

    private async trySwitchVehicleSeat(targetSeat: VehicleSeat): Promise<boolean> {
        const ped = PlayerPedId();
        const vehicle = GetVehiclePedIsIn(ped, false);

        if (!vehicle) {
            return false;
        }

        if (AllowedTaxiModel.includes(GetEntityModel(vehicle))) {
            this.notifier.notify('Impossible de changer de place dans un taxi.', 'error');

            return true;
        }

        if (GetVehicleNumberPlateText(vehicle).trim() === DrivingSchoolConfig.vehiclePlateText) {
            this.notifier.notify('Impossible de changer de place pendant un examen de conduite.', 'error');

            return true;
        }

        if (GetVehiclePedIsEntering(ped) === vehicle) {
            return false;
        }

        const currentSeat = GetPedInVehicleSeat(vehicle, targetSeat);

        if (currentSeat === ped) {
            return false;
        }

        if (targetSeat !== VehicleSeat.Driver && targetSeat >= GetVehicleMaxNumberOfPassengers(vehicle)) {
            return false;
        }

        const pedSeat = this.getPedVehicleSeat(vehicle, ped);

        if (pedSeat !== null && pedSeat > VehicleSeat.BackRight) {
            this.notifier.notify('Vous ne pouvez pas rejoindre cette place depuis votre siège actuel.', 'error');

            return true;
        }

        const isMovingFromBackToFront =
            (pedSeat === VehicleSeat.BackLeft || pedSeat === VehicleSeat.BackRight) &&
            (targetSeat === VehicleSeat.Driver || targetSeat === VehicleSeat.Copilot);

        if (isMovingFromBackToFront && VEHICLE_SEAT_SWITCH_FORBIDDEN_CLASSES.includes(GetVehicleClass(vehicle))) {
            this.notifier.notify('Vous ne pouvez pas rejoindre cette place depuis votre siège actuel.', 'error');

            return true;
        }

        const isLeavingDriverSeat = GetPedInVehicleSeat(vehicle, VehicleSeat.Driver) === ped;

        if (isLeavingDriverSeat && GetEntitySpeed(vehicle) * 3.6 > VEHICLE_SEAT_SWITCH_MAX_SPEED_KMH) {
            this.notifier.notify('Vous allez trop vite pour changer de place.', 'error');

            return true;
        }

        if (this.vehicleSeatbeltProvider.isSeatbeltOnForPlayer()) {
            this.notifier.notify('Détachez votre ceinture avant de changer de place.', 'error');

            return true;
        }

        if (!IsVehicleSeatFree(vehicle, targetSeat)) {
            this.notifier.notify('Cette place est déjà occupée.', 'error');

            return true;
        }

        const isAdjacentRowSwap =
            (pedSeat === VehicleSeat.Driver && targetSeat === VehicleSeat.Copilot) ||
            (pedSeat === VehicleSeat.Copilot && targetSeat === VehicleSeat.Driver) ||
            (pedSeat === VehicleSeat.BackLeft && targetSeat === VehicleSeat.BackRight) ||
            (pedSeat === VehicleSeat.BackRight && targetSeat === VehicleSeat.BackLeft);

        if (isAdjacentRowSwap) {
            TaskShuffleToNextVehicleSeat(ped, vehicle);
        } else {
            SetPedIntoVehicle(ped, vehicle, targetSeat);
        }

        return true;
    }

    @Command('inventory.use.1', {
        description: "Raccourci d'arme principale / conducteur",
        keys: [{ mapper: 'keyboard', key: '1' }],
    })
    async useItem1() {
        if (await this.trySwitchVehicleSeat(VehicleSeat.Driver)) return;
        await this.useItem(1);
    }

    @Command('inventory.use.2', {
        description: "Raccourci d'arme secondaire / passager avant",
        keys: [{ mapper: 'keyboard', key: '2' }],
    })
    async useItem2() {
        if (await this.trySwitchVehicleSeat(VehicleSeat.Copilot)) return;
        await this.useItem(2);
    }

    @Command('inventory.use.3', {
        description: "Raccourci d'inventaire 03 / passager arrière gauche",
        keys: [{ mapper: 'keyboard', key: '3' }],
    })
    async useItem3() {
        if (await this.trySwitchVehicleSeat(VehicleSeat.BackLeft)) return;
        await this.useItem(3);
    }

    @Command('inventory.use.4', {
        description: "Raccourci d'inventaire 04 / passager arrière droit",
        keys: [{ mapper: 'keyboard', key: '4' }],
    })
    async useItem4() {
        if (await this.trySwitchVehicleSeat(VehicleSeat.BackRight)) return;
        await this.useItem(4);
    }

    @Command('inventory.use.5', { description: "Raccourci d'inventaire 05", keys: [{ mapper: 'keyboard', key: '5' }] })
    async useItem5() {
        await this.useItem(5);
    }

    @Command('inventory.use.6', { description: "Raccourci d'inventaire 06", keys: [{ mapper: 'keyboard', key: '6' }] })
    async useItem6() {
        await this.useItem(6);
    }

    @Command('inventory.use.7', { description: "Raccourci d'inventaire 07", keys: [{ mapper: 'keyboard', key: '7' }] })
    async useItem7() {
        await this.useItem(7);
    }

    @Command('inventory.use.8', { description: "Raccourci d'inventaire 08", keys: [{ mapper: 'keyboard', key: '8' }] })
    async useItem8() {
        await this.useItem(8);
    }

    @Command('inventory.use.9', { description: "Raccourci d'inventaire 09", keys: [{ mapper: 'keyboard', key: '9' }] })
    async useItem9() {
        await this.useItem(9);
    }

    @Command('inventory.use.0', { description: "Raccourci d'inventaire 10", keys: [{ mapper: 'keyboard', key: '0' }] })
    async useItem0() {
        await this.useItem(0);
    }
}
