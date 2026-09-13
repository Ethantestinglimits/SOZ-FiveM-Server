import { Inject, Injectable } from '../../core/decorators/injectable';
import { PHONE_ITEM, PhoneDevice } from '../../shared/phone/device';
import { InventoryFactory } from '../inventory/inventory.factory';
import { ServerStateService } from '../server.state.service';
import { PhoneDeviceRepository } from './phone.device.repository';

@Injectable()
export class PhoneDeviceService {
    @Inject(PhoneDeviceRepository)
    private readonly phoneDeviceRepository: PhoneDeviceRepository;

    @Inject(InventoryFactory)
    private readonly inventoryFactory: InventoryFactory;

    @Inject(ServerStateService)
    private readonly serverStateService: ServerStateService;

    private openedDevices = new Map<number, PhoneDevice>();

    public setOpenedDevice(source: number, device: PhoneDevice): void {
        this.openedDevices.set(source, device);
    }

    public getOpenedDevice(source: number): PhoneDevice | null {
        return this.openedDevices.get(source) || null;
    }

    public updateOpenedDevice(source: number, device: PhoneDevice): void {
        const opened = this.openedDevices.get(source);

        if (opened && opened.id === device.id) {
            this.openedDevices.set(source, device);
        }
    }

    public clearOpenedDevice(source: number): void {
        this.openedDevices.delete(source);
    }

    public async findCarrier(deviceId: string): Promise<number | null> {
        for (const player of this.serverStateService.getPlayers()) {
            const inventory = await this.inventoryFactory.getPlayerInventory(player.source);

            if (!inventory) {
                continue;
            }

            for (const inventoryItem of Object.values(inventory.items())) {
                if (inventoryItem.name === PHONE_ITEM && inventoryItem.metadata?.id === deviceId) {
                    return player.source;
                }
            }
        }

        return null;
    }

    public async findDeviceByNumber(number: string): Promise<{ deviceId: string; source: number | null } | null> {
        const device = await this.phoneDeviceRepository.getDeviceBySimNumber(number);

        if (!device) {
            return null;
        }

        return { deviceId: device.id, source: await this.findCarrier(device.id) };
    }
}
