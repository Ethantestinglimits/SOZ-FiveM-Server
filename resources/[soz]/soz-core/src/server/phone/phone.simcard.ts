import { Provider } from '@public/core/decorators/provider';

import { Inject } from '../../core/decorators/injectable';
import { Rpc } from '../../core/decorators/rpc';
import { ClientEvent } from '../../shared/event/client';
import { RpcServerEvent } from '../../shared/rpc';
import { PrismaService } from '../database/prisma.service';
import { PhoneDeviceService } from './phone.device.service';

@Provider()
export class PhoneSimCard {
    @Inject(PrismaService)
    private readonly prismaService: PrismaService;

    @Inject(PhoneDeviceService)
    private readonly phoneDeviceService: PhoneDeviceService;

    @Rpc(RpcServerEvent.PHONE_SIMCARD_RESET)
    async reset(source: number) {
        const device = this.phoneDeviceService.getOpenedDevice(source);

        if (!device) {
            return;
        }

        if (device.simNumber) {
            await this.prismaService.phone_profile.deleteMany({
                where: {
                    number: device.simNumber,
                },
            });
        }

        await this.prismaService.phone_notes.deleteMany({
            where: {
                device_id: device.id,
            },
        });

        await this.prismaService.phone_contacts.deleteMany({
            where: {
                device_id: device.id,
            },
        });

        await this.prismaService.phone_gallery.deleteMany({
            where: {
                device_id: device.id,
            },
        });

        TriggerClientEvent(ClientEvent.ADMIN_SWITCH_CHARACTER, source);
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_GET_AVATAR)
    async getAvatar(source: number): Promise<string> {
        const device = this.phoneDeviceService.getOpenedDevice(source);

        if (!device?.simNumber) {
            return null;
        }

        const profile = await this.prismaService.phone_profile.findFirst({
            select: {
                avatar: true,
            },
            where: {
                number: device.simNumber,
            },
        });

        return profile?.avatar;
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_UPDATE_AVATAR)
    async updateAvatar(source: number, avatar: string) {
        const device = this.phoneDeviceService.getOpenedDevice(source);

        if (!device?.simNumber) {
            return;
        }

        await this.prismaService.phone_profile.upsert({
            where: {
                number: device.simNumber,
            },
            update: {
                avatar,
            },
            create: {
                number: device.simNumber,
                avatar,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_CALLS_HISTORY_GET)
    async getCallHistory(source: number) {
        const device = this.phoneDeviceService.getOpenedDevice(source);

        if (!device?.simNumber) {
            return [];
        }

        const history = await this.prismaService.phone_calls.findMany({
            where: {
                OR: [
                    {
                        receiver: device.simNumber,
                    },
                    {
                        transmitter: device.simNumber,
                    },
                ],
            },
            orderBy: {
                end: 'desc',
            },
            take: 50,
        });

        return history.map(call => ({ ...call, start: Number(call.start), end: Number(call.end) }));
    }
}
