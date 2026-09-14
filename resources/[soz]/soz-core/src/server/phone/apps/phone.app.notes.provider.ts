import { Provider } from '@public/core/decorators/provider';
import { RpcServerEvent } from '@public/shared/rpc';

import { Inject } from '../../../core/decorators/injectable';
import { Rpc } from '../../../core/decorators/rpc';
import { PrismaService } from '../../database/prisma.service';
import { PhoneDeviceService } from '../phone.device.service';

@Provider()
export class PhoneAppNotesProvider {
    @Inject(PrismaService)
    private readonly prismaService: PrismaService;

    @Inject(PhoneDeviceService)
    private readonly phoneDeviceService: PhoneDeviceService;

    @Rpc(RpcServerEvent.PHONE_APP_NOTES_GET)
    async getNotes(source: number) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return [];
        }

        return this.prismaService.phone_notes.findMany({
            select: {
                id: true,
                title: true,
                content: true,
            },
            where: {
                device_id: device.id,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_APP_NOTES_ADD)
    async addNote(source: number, title: string, content: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        return this.prismaService.phone_notes.create({
            data: {
                title,
                content,
                identifier: '',
                device_id: device.id,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_APP_NOTES_UPDATE)
    async updateNote(source: number, id: number, title: string, content: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        return this.prismaService.phone_notes.update({
            where: { id, device_id: device.id },
            data: {
                title,
                content,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_APP_NOTES_DELETE)
    async deleteNote(source: number, id: number) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        return this.prismaService.phone_notes.delete({
            where: { id, device_id: device.id },
        });
    }
}
