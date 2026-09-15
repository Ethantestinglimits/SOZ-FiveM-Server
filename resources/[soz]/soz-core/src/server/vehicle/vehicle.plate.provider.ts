import { InventoryFactory } from '@public/server/inventory/inventory.factory';
import { RpcServerEvent } from '@public/shared/rpc';
import { TaxType } from '@public/shared/tax';
import { CustomPlateVehicle, validateCustomPlate } from '@public/shared/vehicle/plate';

import { OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Rpc } from '../../core/decorators/rpc';
import { ServerEvent } from '../../shared/event';
import { isErr } from '../../shared/result';
import { PlayerVehicleState } from '../../shared/vehicle/player.vehicle';
import { PrismaService } from '../database/prisma.service';
import { Monitor } from '../monitor/monitor';
import { Notifier } from '../notifier';
import { PlayerMoneyService } from '../player/player.money.service';
import { PlayerService } from '../player/player.service';
import { VehicleRepository } from '../repository/vehicle.repository';
import { VehicleStateService } from './vehicle.state.service';

const CUSTOM_PLATE_PRICE_RATIO = 0.15;

@Provider()
export class VehiclePlateProvider {
    @Inject(PrismaService)
    private prismaService: PrismaService;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(PlayerMoneyService)
    private playerMoneyService: PlayerMoneyService;

    @Inject(VehicleRepository)
    private vehicleRepository: VehicleRepository;

    @Inject(VehicleStateService)
    private vehicleStateService: VehicleStateService;

    @Inject(InventoryFactory)
    private inventoryFactory: InventoryFactory;

    @Inject(Notifier)
    private notifier: Notifier;

    @Inject(Monitor)
    private monitor: Monitor;

    @Rpc(RpcServerEvent.CUSTOM_PLATE_GET_VEHICLES)
    public async getVehicles(source: number): Promise<CustomPlateVehicle[]> {
        const player = this.playerService.getPlayer(source);

        if (!player) {
            return [];
        }

        const vehicles = await this.prismaService.playerVehicle.findMany({
            where: {
                citizenid: player.citizenid,
                job: null,
                state: {
                    not: PlayerVehicleState.Destroyed,
                },
            },
        });

        const result: CustomPlateVehicle[] = [];

        for (const vehicle of vehicles) {
            const catalogVehicle = await this.vehicleRepository.findByModel(vehicle.vehicle);

            if (!catalogVehicle) {
                continue;
            }

            result.push({
                id: vehicle.id,
                label: vehicle.label || catalogVehicle.name,
                plate: vehicle.plate,
                price: Math.ceil(catalogVehicle.price * CUSTOM_PLATE_PRICE_RATIO),
            });
        }

        return result;
    }

    @OnEvent(ServerEvent.CUSTOM_PLATE_BUY)
    public async buyCustomPlate(source: number, vehicleId: number, plate: string): Promise<void> {
        const player = this.playerService.getPlayer(source);

        if (!player) {
            return;
        }

        const vehicle = await this.prismaService.playerVehicle.findUnique({
            where: { id: vehicleId },
        });

        if (!vehicle || vehicle.citizenid !== player.citizenid || vehicle.job) {
            this.notifier.notify(source, "Ce véhicule ne vous appartient pas.", 'error');

            return;
        }

        const validatedPlate = validateCustomPlate(plate);

        if (isErr(validatedPlate)) {
            this.notifier.notify(source, validatedPlate.err, 'error');

            return;
        }

        const newPlate = validatedPlate.ok;

        if (await this.isPlateTaken(newPlate, vehicleId)) {
            this.notifier.notify(source, 'Cette plaque est déjà utilisée par un autre véhicule.', 'error');

            return;
        }

        const catalogVehicle = await this.vehicleRepository.findByModel(vehicle.vehicle);

        if (!catalogVehicle) {
            this.notifier.notify(source, 'Impossible de calculer le prix de la plaque.', 'error');

            return;
        }

        const price = Math.ceil(catalogVehicle.price * CUSTOM_PLATE_PRICE_RATIO);

        if (!(await this.playerMoneyService.buy(source, price, TaxType.VEHICLE))) {
            this.notifier.notify(source, "Vous n'avez pas assez d'argent.", 'error');

            return;
        }

        await this.prismaService.playerVehicle.update({
            where: { id: vehicleId },
            data: {
                plate: newPlate,
                plateUpdateTime: Math.floor(Date.now() / 1000),
            },
        });

        this.vehicleStateService.renameVehicleKey(vehicle.plate, newPlate);

        const netId = this.findVehicleNetworkId(vehicleId);

        if (netId) {
            this.vehicleStateService.updateVehicleVolatileState(netId, { plate: newPlate }, null, true);
        }

        this.notifier.notify(source, `Votre véhicule affiche maintenant la plaque ${newPlate}.`, 'success');

        this.monitor.traceEvent('custom_plate_buy', {
            player_source: source,
            vehicle_id: vehicleId,
            vehicle_plate: newPlate,
            money: price,
        });
    }

    @OnEvent(ServerEvent.CUSTOM_PLATE_APPLY_FAKE)
    public async applyFakePlate(source: number, vehicleNetworkId: number, plate: string): Promise<void> {
        const state = this.vehicleStateService.getVehicleState(vehicleNetworkId);

        if (!state || !state.volatile.id) {
            this.notifier.notify(source, "Ce véhicule ne peut pas recevoir de plaque personnalisée.", 'error');

            return;
        }

        const validatedPlate = validateCustomPlate(plate);

        if (isErr(validatedPlate)) {
            this.notifier.notify(source, validatedPlate.err, 'error');

            return;
        }

        const newPlate = validatedPlate.ok;

        if (await this.isPlateTaken(newPlate)) {
            this.notifier.notify(source, 'Cette plaque est déjà utilisée par un autre véhicule.', 'error');

            return;
        }

        const inventory = await this.inventoryFactory.getPlayerInventory(source);

        if (!inventory || !inventory.remove('plaque_perso_temp', 1, false)) {
            this.notifier.notify(source, "Vous n'avez pas de plaque personnalisée temporaire.", 'error');

            return;
        }

        await this.prismaService.playerVehicle.update({
            where: { id: state.volatile.id },
            data: {
                fakeplate: newPlate,
            },
        });

        this.vehicleStateService.updateVehicleVolatileState(vehicleNetworkId, { fakeplate: newPlate }, null, true);

        this.notifier.notify(source, `Le véhicule affiche maintenant la plaque ${newPlate}.`, 'success');

        this.monitor.traceEvent('custom_plate_apply_fake', {
            player_source: source,
            vehicle_id: state.volatile.id,
            vehicle_plate: newPlate,
        });
    }

    private async isPlateTaken(plate: string, excludeVehicleId?: number): Promise<boolean> {
        const existing = await this.prismaService.playerVehicle.findFirst({
            where: {
                OR: [{ plate }, { fakeplate: plate }],
                ...(excludeVehicleId ? { NOT: { id: excludeVehicleId } } : {}),
            },
        });

        return !!existing;
    }

    private findVehicleNetworkId(vehicleId: number): number | null {
        for (const [netId, state] of this.vehicleStateService.getStates().entries()) {
            if (state.volatile.id === vehicleId) {
                return netId;
            }
        }

        return null;
    }
}
