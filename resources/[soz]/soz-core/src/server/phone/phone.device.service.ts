import { Inject, Injectable } from '../../core/decorators/injectable';
import { PHONE_ITEM, PhoneDevice } from '../../shared/phone/device';
import { PlayerData } from '../../shared/player';

const MAX_UNLOCK_ATTEMPTS = 5;
const UNLOCK_LOCKOUT_DURATION = 60_000;
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

    private unlockFailures = new Map<string, { attempts: number; blockedUntil: number }>();

    public setOpenedDevice(source: number, device: PhoneDevice): void {
        this.openedDevices.set(source, device);
    }

    public getOpenedDevice(source: number): PhoneDevice | null {
        return this.openedDevices.get(source) || null;
    }

    public getUnlockedDevice(source: number): PhoneDevice | null {
        const device = this.openedDevices.get(source);

        if (!device || !device.initialized || device.isLocked) {
            return null;
        }

        return device;
    }

    public updateOpenedDevice(source: number, device: PhoneDevice): PhoneDevice {
        const opened = this.openedDevices.get(source);

        if (!opened || opened.id !== device.id) {
            return device;
        }

        const updated = { ...device, isLocked: opened.isLocked && device.isLocked };

        this.openedDevices.set(source, updated);

        return updated;
    }

    public getUnlockRetryDelay(deviceId: string): number {
        const failure = this.unlockFailures.get(deviceId);

        if (!failure || failure.blockedUntil <= Date.now()) {
            return 0;
        }

        return Math.ceil((failure.blockedUntil - Date.now()) / 1000);
    }

    public registerUnlockFailure(deviceId: string): number {
        const failure = this.unlockFailures.get(deviceId) || { attempts: 0, blockedUntil: 0 };

        failure.attempts++;

        if (failure.attempts >= MAX_UNLOCK_ATTEMPTS) {
            failure.attempts = 0;
            failure.blockedUntil = Date.now() + UNLOCK_LOCKOUT_DURATION;
        }

        this.unlockFailures.set(deviceId, failure);

        return this.getUnlockRetryDelay(deviceId);
    }

    public clearUnlockFailures(deviceId: string): void {
        this.unlockFailures.delete(deviceId);
    }

    public clearOpenedDevice(source: number): void {
        this.openedDevices.delete(source);
    }

    public async findCarrier(deviceId: string): Promise<number | null> {
        const carrier = await this.findCarrierPlayer(deviceId);

        return carrier ? carrier.source : null;
    }

    public async findDeviceByNumber(
        number: string
    ): Promise<{ deviceId: string; source: number | null; isMain: boolean } | null> {
        const device = await this.phoneDeviceRepository.getDeviceBySimNumber(number);

        if (!device) {
            return null;
        }

        const carrier = await this.findCarrierPlayer(device.id);

        return {
            deviceId: device.id,
            source: carrier ? carrier.source : null,
            isMain: Boolean(carrier) && device.main_for === carrier.citizenid,
        };
    }

    private async findCarrierPlayer(deviceId: string): Promise<PlayerData | null> {
        for (const player of this.serverStateService.getPlayers()) {
            const inventory = await this.inventoryFactory.getPlayerInventory(player.source);

            if (!inventory) {
                continue;
            }

            for (const inventoryItem of Object.values(inventory.items())) {
                if (inventoryItem.name === PHONE_ITEM && inventoryItem.metadata?.id === deviceId) {
                    return player;
                }
            }
        }

        return null;
    }
}
