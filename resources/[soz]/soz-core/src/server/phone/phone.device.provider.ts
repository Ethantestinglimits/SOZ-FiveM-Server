import { phone_device } from '@prisma/client';
import { Provider } from '@public/core/decorators/provider';

import { On, Once, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Rpc } from '../../core/decorators/rpc';
import { ClientEvent } from '../../shared/event/client';
import { ServerEvent } from '../../shared/event/server';
import { ADD_ERROR_MESSAGE, InventoryItem } from '../../shared/inventory';
import { PHONE_ITEM, PhoneDevice, PhoneDeviceSettings, ZIM_CARD_ITEM } from '../../shared/phone/device';
import { isOk } from '../../shared/result';
import { RpcServerEvent } from '../../shared/rpc';
import { Inventory } from '../inventory/inventory';
import { InventoryFactory } from '../inventory/inventory.factory';
import { ItemService } from '../item/item.service';
import { Notifier } from '../notifier';
import { PlayerService } from '../player/player.service';
import { InsertSimError, PhoneDeviceRepository } from './phone.device.repository';
import { PhoneDeviceService } from './phone.device.service';

const INSERT_SIM_ERROR_MESSAGE: Record<InsertSimError, string> = {
    device_has_sim: 'Ce téléphone contient déjà une Carte ZIM.',
    sim_not_found: 'Cette Carte ZIM est illisible.',
    sim_in_use: 'Cette Carte ZIM est déjà insérée dans un autre téléphone.',
};

const toPhoneDevice = (device: phone_device, citizenid: string): PhoneDevice => ({
    id: device.id,
    frame: device.frame,
    simNumber: device.sim_number,
    initialized: device.initialized,
    isMain: device.main_for === citizenid,
    hasPinCode: device.pin_code !== null,
    settings: (device.settings as unknown as PhoneDeviceSettings) || {},
});

@Provider()
export class PhoneDeviceProvider {
    @Inject(PhoneDeviceRepository)
    private readonly phoneDeviceRepository: PhoneDeviceRepository;

    @Inject(PhoneDeviceService)
    private readonly phoneDeviceService: PhoneDeviceService;

    @Inject(InventoryFactory)
    private readonly inventoryFactory: InventoryFactory;

    @Inject(ItemService)
    private readonly itemService: ItemService;

    @Inject(PlayerService)
    private readonly playerService: PlayerService;

    @Inject(Notifier)
    private readonly notifier: Notifier;

    @Once()
    public onStart(): void {
        this.itemService.setItemUseCallback(PHONE_ITEM, async (source, _item, inventoryItem, inventory) => {
            const device = await this.resolveDevice(source, inventory, inventoryItem);

            if (!device) {
                return;
            }

            this.phoneDeviceService.setOpenedDevice(source, device);
            TriggerClientEvent(ClientEvent.PHONE_DEVICE_OPEN, source, device);
        });

        this.itemService.setItemUseCallback(ZIM_CARD_ITEM, async (source, _item, inventoryItem, inventory) => {
            const main = await this.findMainPhone(source);

            if (!main) {
                this.notifier.error(source, "Vous n'avez pas votre téléphone principal sur vous.");

                return;
            }

            await this.insertSimCard(source, inventory, inventoryItem, main.inventory, main.inventoryItem);
        });
    }

    @Rpc(RpcServerEvent.PHONE_DEVICE_GET_MAIN)
    public async getMainDevice(source: number): Promise<PhoneDevice | null> {
        const main = await this.findMainPhone(source);

        if (!main) {
            return null;
        }

        this.phoneDeviceService.setOpenedDevice(source, main.device);

        return main.device;
    }

    @On('QBCore:Server:PlayerUnload', false)
    public onPlayerUnload(source: number): void {
        this.phoneDeviceService.clearOpenedDevice(source);
    }

    @OnEvent(ServerEvent.PHONE_DEVICE_SET_MAIN)
    public async onSetMainDevice(source: number, inventoryId: string, slot: number): Promise<void> {
        const player = this.playerService.getPlayer(source);
        const phone = await this.getCarriedPhone(source, inventoryId, slot);

        if (!player || !phone) {
            return;
        }

        if (phone.device.isMain) {
            this.notifier.notify(source, 'Ce téléphone est déjà votre téléphone principal.', 'info');

            return;
        }

        await this.phoneDeviceRepository.setMainDevice(player.citizenid, phone.device.id);

        this.notifier.notify(source, 'Ce téléphone est désormais votre ~b~téléphone principal~s~.', 'success');
    }

    @OnEvent(ServerEvent.PHONE_DEVICE_REMOVE_SIM)
    public async onRemoveSimCard(source: number, inventoryId: string, slot: number): Promise<void> {
        const phone = await this.getCarriedPhone(source, inventoryId, slot);

        if (!phone) {
            return;
        }

        const { inventory, inventoryItem, device } = phone;

        if (!device.simNumber) {
            this.notifier.error(source, 'Aucune Carte ZIM présente dans ce téléphone.');

            return;
        }

        if (!inventory.canCarryItem(ZIM_CARD_ITEM, 1, { simNumber: device.simNumber })) {
            this.notifier.error(source, "Vous n'avez pas assez de place pour la Carte ZIM.");

            return;
        }

        const number = await this.phoneDeviceRepository.removeSim(device.id);

        if (!number) {
            this.notifier.error(source, 'Aucune Carte ZIM présente dans ce téléphone.');

            return;
        }

        const added = inventory.add(ZIM_CARD_ITEM, 1, { simNumber: number, label: number });

        if (!isOk(added)) {
            await this.phoneDeviceRepository.insertSim(device.id, number);
            this.notifier.error(source, ADD_ERROR_MESSAGE[added.err]);

            return;
        }

        inventory.updateMetadataAtSlot(inventoryItem.slot, { simNumber: undefined });
        await inventory.observe();

        const updated = { ...device, simNumber: null };

        this.phoneDeviceService.updateOpenedDevice(source, updated);
        this.notifier.notify(source, 'Vous avez retiré la ~b~Carte ZIM ' + number + '~s~.', 'success');
        TriggerClientEvent(ClientEvent.PHONE_DEVICE_UPDATE, source, updated);
    }

    public async insertSimCard(
        source: number,
        sourceInventory: Inventory,
        simItem: InventoryItem,
        targetInventory: Inventory,
        phoneItem: InventoryItem
    ): Promise<void> {
        const number = simItem.metadata?.simNumber;

        if (!number) {
            this.notifier.error(source, 'Cette Carte ZIM est illisible.');

            return;
        }

        const device = await this.resolveDevice(source, targetInventory, phoneItem);

        if (!device) {
            return;
        }

        if (device.simNumber) {
            this.notifier.error(source, INSERT_SIM_ERROR_MESSAGE.device_has_sim);

            return;
        }

        await this.phoneDeviceRepository.ensureSim(number);

        const result = await this.phoneDeviceRepository.insertSim(device.id, number);

        if (!isOk(result)) {
            this.notifier.error(source, INSERT_SIM_ERROR_MESSAGE[result.err]);

            return;
        }

        sourceInventory.removeAtSlot(simItem.slot, 1);
        targetInventory.updateMetadataAtSlot(phoneItem.slot, { simNumber: number });

        await sourceInventory.observe();
        await targetInventory.observe();

        const updated = { ...device, simNumber: number };

        this.phoneDeviceService.updateOpenedDevice(source, updated);
        this.notifier.notify(source, 'Vous avez inséré la ~b~Carte ZIM ' + number + '~s~.', 'success');
        TriggerClientEvent(ClientEvent.PHONE_DEVICE_UPDATE, source, updated);
    }

    private async findMainPhone(
        source: number
    ): Promise<{ inventory: Inventory; inventoryItem: InventoryItem; device: PhoneDevice } | null> {
        const inventory = await this.inventoryFactory.getPlayerInventory(source);

        if (!inventory) {
            return null;
        }

        for (const inventoryItem of Object.values(inventory.items())) {
            if (inventoryItem.name !== PHONE_ITEM) {
                continue;
            }

            const device = await this.resolveDevice(source, inventory, inventoryItem);

            if (device?.isMain) {
                return { inventory, inventoryItem, device };
            }
        }

        return null;
    }

    private async getCarriedPhone(
        source: number,
        inventoryId: string,
        slot: number
    ): Promise<{ inventory: Inventory; inventoryItem: InventoryItem; device: PhoneDevice } | null> {
        const inventory = await this.inventoryFactory.getPlayerInventory(source);

        if (!inventory || inventory.id !== inventoryId) {
            this.notifier.error(source, 'Vous devez avoir ce téléphone sur vous.');

            return null;
        }

        const inventoryItem = inventory.getItemAtSlot(slot);

        if (!inventoryItem || inventoryItem.name !== PHONE_ITEM) {
            return null;
        }

        const device = await this.resolveDevice(source, inventory, inventoryItem);

        if (!device) {
            return null;
        }

        return { inventory, inventoryItem, device };
    }

    private async resolveDevice(
        source: number,
        inventory: Inventory,
        inventoryItem: InventoryItem
    ): Promise<PhoneDevice | null> {
        const player = this.playerService.getPlayer(source);

        if (!player) {
            return null;
        }

        const deviceId = inventoryItem.metadata?.id;

        if (deviceId) {
            const device = await this.phoneDeviceRepository.getDevice(deviceId);

            if (device) {
                await this.syncSimMetadata(inventory, inventoryItem, device.sim_number);

                return toPhoneDevice(device, player.citizenid);
            }
        }

        const createdId = await this.phoneDeviceRepository.createDevice();

        inventory.updateMetadataAtSlot(inventoryItem.slot, { id: createdId });
        await inventory.observe();

        if (!(await this.phoneDeviceRepository.getMainDevice(player.citizenid))) {
            await this.phoneDeviceRepository.setMainDevice(player.citizenid, createdId);

            if (player.charinfo.phone) {
                await this.phoneDeviceRepository.ensureSim(player.charinfo.phone, player.citizenid);
                await this.phoneDeviceRepository.insertSim(createdId, player.charinfo.phone);
            }
        }

        const device = await this.phoneDeviceRepository.getDevice(createdId);

        if (!device) {
            return null;
        }

        await this.syncSimMetadata(inventory, inventoryItem, device.sim_number);

        return toPhoneDevice(device, player.citizenid);
    }

    private async syncSimMetadata(
        inventory: Inventory,
        inventoryItem: InventoryItem,
        simNumber: string | null
    ): Promise<void> {
        if ((inventoryItem.metadata?.simNumber || null) === simNumber) {
            return;
        }

        inventory.updateMetadataAtSlot(inventoryItem.slot, { simNumber: simNumber || undefined });
        await inventory.observe();
    }
}
