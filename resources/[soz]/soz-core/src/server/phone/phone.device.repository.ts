import { Prisma } from '@prisma/client';

import { Inject, Injectable } from '../../core/decorators/injectable';
import { uuidv4 } from '../../core/utils';
import { PhoneDeviceSettings } from '../../shared/phone/device';
import { getRandomInt } from '../../shared/random';
import { Err, Ok, Result } from '../../shared/result';
import { PrismaService } from '../database/prisma.service';

export type InsertSimError = 'device_has_sim' | 'sim_not_found' | 'sim_in_use';

const NUMBER_PREFIX_START = 555;
const NUMBER_PREFIX_END = 999;

const formatNumber = (prefix: number, suffix: number): string => `${prefix}-${String(suffix).padStart(4, '0')}`;

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
            const number = await this.generateAvailableNumber();

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

    public async deleteDevices(deviceIds: string[]): Promise<void> {
        if (deviceIds.length === 0) {
            return;
        }

        const where = { device_id: { in: deviceIds } };

        await this.prismaService.phone_contacts.deleteMany({ where });
        await this.prismaService.phone_notes.deleteMany({ where });
        await this.prismaService.phone_gallery.deleteMany({ where });
        await this.prismaService.phone_calls.deleteMany({ where });
        await this.prismaService.phone_messages.deleteMany({ where });
        await this.prismaService.phone_messages_conversations.deleteMany({ where });
        await this.prismaService.phone_device.deleteMany({ where: { id: { in: deviceIds } } });
    }

    public async releaseSim(number: string): Promise<void> {
        await this.prismaService.phone_device.updateMany({
            where: { sim_number: number },
            data: { sim_number: null },
        });

        await this.prismaService.phone_profile.deleteMany({ where: { number } });
        await this.prismaService.phone_sim.deleteMany({ where: { number } });
    }

    private async generateAvailableNumber(): Promise<string> {
        for (let prefix = NUMBER_PREFIX_START; prefix <= NUMBER_PREFIX_END; prefix++) {
            for (let attempt = 0; attempt < 25; attempt++) {
                const number = formatNumber(prefix, getRandomInt(0, 9999));

                if (!(await this.isNumberTaken(number))) {
                    return number;
                }
            }

            const number = await this.findFreeNumberInPrefix(prefix);

            if (number) {
                return number;
            }
        }

        throw new Error('phone: plus aucun numéro de téléphone disponible');
    }

    private async isNumberTaken(number: string): Promise<boolean> {
        const sim = await this.prismaService.phone_sim.findUnique({ where: { number }, select: { number: true } });

        if (sim) {
            return true;
        }

        const players = await this.prismaService.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) AS count FROM player WHERE charinfo LIKE ${'%' + number + '%'}
        `;

        return Number(players[0]?.count ?? 0) > 0;
    }

    private async findFreeNumberInPrefix(prefix: number): Promise<string | null> {
        const [sims, players] = await Promise.all([
            this.prismaService.phone_sim.findMany({
                where: { number: { startsWith: `${prefix}-` } },
                select: { number: true },
            }),
            this.prismaService.$queryRaw<{ number: string }[]>`
                SELECT JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.phone')) AS number
                FROM player
                WHERE JSON_VALID(charinfo)
            `,
        ]);

        const taken = new Set([...sims.map(sim => sim.number), ...players.map(player => player.number)]);

        for (let suffix = 0; suffix < 10000; suffix++) {
            const number = formatNumber(prefix, suffix);

            if (!taken.has(number)) {
                return number;
            }
        }

        return null;
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

    public async updateSettings(deviceId: string, settings: PhoneDeviceSettings): Promise<void> {
        await this.prismaService.phone_device.update({
            where: { id: deviceId },
            data: { settings: settings as Prisma.InputJsonValue },
        });
    }

    public async setupDevice(
        deviceId: string,
        owner: string,
        pinCode: string,
        settings: PhoneDeviceSettings
    ): Promise<boolean> {
        const { count } = await this.prismaService.phone_device.updateMany({
            where: {
                id: deviceId,
                OR: [{ initialized: false }, { pin_code: null, owner }],
            },
            data: {
                initialized: true,
                owner,
                pin_code: pinCode,
                settings: settings as Prisma.InputJsonValue,
            },
        });

        return count > 0;
    }

    public async resetDevice(deviceId: string): Promise<void> {
        await this.prismaService.phone_device.update({
            where: { id: deviceId },
            data: {
                initialized: false,
                owner: null,
                pin_code: null,
                settings: Prisma.DbNull,
            },
        });
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
