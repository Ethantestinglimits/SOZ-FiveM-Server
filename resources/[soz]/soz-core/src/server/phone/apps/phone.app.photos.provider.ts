import { Provider } from '@public/core/decorators/provider';

import { Inject } from '../../../core/decorators/injectable';
import { Rpc } from '../../../core/decorators/rpc';
import { RpcServerEvent } from '../../../shared/rpc';
import { PrismaService } from '../../database/prisma.service';
import { PhoneDeviceService } from '../phone.device.service';

@Provider()
export class PhoneAppPhotosProvider {
    @Inject(PrismaService)
    private readonly prismaService: PrismaService;

    @Inject(PhoneDeviceService)
    private readonly phoneDeviceService: PhoneDeviceService;

    @Rpc(RpcServerEvent.PHONE_APP_PHOTOS_GET)
    async getPhotos(source: number) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return [];
        }

        return this.prismaService.phone_gallery.findMany({
            select: {
                id: true,
                image: true,
            },
            where: {
                device_id: device.id,
            },
            orderBy: {
                id: 'desc',
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_APP_PHOTOS_UPLOAD)
    async takePhoto(source: number, image: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        return this.prismaService.phone_gallery.create({
            data: {
                device_id: device.id,
                image,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_APP_PHOTOS_DELETE)
    async deletePhoto(source: number, id: number) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        await this.prismaService.phone_gallery.delete({
            where: {
                id,
                device_id: device.id,
            },
        });
    }
}
