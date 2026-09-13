import { Prisma } from '@prisma/client';

import { Inject, Injectable } from '../../core/decorators/injectable';
import { uuidv4 } from '../../core/utils';
import { Err, Ok, Result } from '../../shared/result';
import { PrismaService } from '../database/prisma.service';

export type InsertSimError = 'device_has_sim' | 'sim_not_found' | 'sim_in_use';

const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isForeignKeyViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

@Injectable()
export class PhoneDeviceRepository {
    @Inject(PrismaService)
    private readonly prismaService: PrismaService;

    public async getDevice(id: string) {
        return this.prismaService.phone_device.findUnique({ where: { id } });
    }

    public async getDeviceBySimNumber(number: string) {
        return this.prismaService.phone_device.findUnique({ where: { sim_number: number } });
    }

    public async getMainDevice(citizenid: string) {
        return this.prismaService.phone_device.findUnique({ where: { main_for: citizenid } });
    }

    public async createDevice(): Promise<string> {
        const id = uuidv4();

        await this.prismaService.phone_device.create({ data: { id } });

        return id;
    }

    public async ensureSim(number: string, owner: string | null = null): Promise<void> {
        await this.prismaService.phone_sim.upsert({
            where: { number },
            update: {},
            create: { number, owner },
        });
    }

    public async createSim(owner: string | null = null): Promise<string> {
        for (let attempt = 0; attempt < 20; attempt++) {
            const number = `555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

            try {
                await this.prismaService.phone_sim.create({ data: { number, owner } });

                return number;
            } catch (error) {
                if (isUniqueViolation(error)) {
                    continue;
                }

                throw error;
            }
        }

        throw new Error('phone: impossible de générer un numéro de Carte ZIM libre');
    }

    public async insertSim(deviceId: string, number: string): Promise<Result<void, InsertSimError>> {
        try {
            const { count } = await this.prismaService.phone_device.updateMany({
                where: { id: deviceId, sim_number: null },
                data: { sim_number: number },
            });

            if (count === 0) {
                return Err('device_has_sim');
            }

            return Ok(undefined);
        } catch (error) {
            if (isUniqueViolation(error)) {
                return Err('sim_in_use');
            }

            if (isForeignKeyViolation(error)) {
                return Err('sim_not_found');
            }

            throw error;
        }
    }

    public async removeSim(deviceId: string): Promise<string | null> {
        const device = await this.prismaService.phone_device.findUnique({
            where: { id: deviceId },
            select: { sim_number: true },
        });

        if (!device?.sim_number) {
            return null;
        }

        await this.prismaService.phone_device.update({
            where: { id: deviceId },
            data: { sim_number: null },
        });

        return device.sim_number;
    }

    public async setMainDevice(citizenid: string, deviceId: string): Promise<void> {
        await this.prismaService.$transaction([
            this.prismaService.phone_device.updateMany({
                where: { main_for: citizenid },
                data: { main_for: null },
            }),
            this.prismaService.phone_device.update({
                where: { id: deviceId },
                data: { main_for: citizenid },
            }),
        ]);
    }
}
