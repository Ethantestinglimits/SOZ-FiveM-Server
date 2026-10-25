import { Prisma } from '@prisma/client';
import { Provider } from '@public/core/decorators/provider';

import { Inject } from '../../core/decorators/injectable';
import { Rpc } from '../../core/decorators/rpc';
import { ClientEvent } from '../../shared/event/client';
import { MessageConversation } from '../../shared/phone/simcard';
import { RpcServerEvent } from '../../shared/rpc';
import { PrismaService } from '../database/prisma.service';
import { PhoneDeviceService } from './phone.device.service';

@Provider()
export class PhoneSimCardMessages {
    @Inject(PrismaService)
    private readonly prismaService: PrismaService;

    @Inject(PhoneDeviceService)
    private readonly phoneDeviceService: PhoneDeviceService;

    @Rpc(RpcServerEvent.PHONE_SIMCARD_MESSAGES_CONVERSATION_GET)
    async getConversations(source: number): Promise<MessageConversation[]> {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return [];
        }

        const conversations = await this.prismaService.$queryRaw<
            {
                id: number;
                unread: number;
                conversation_id: string;
                masked: number;
                participant_identifier: string;
                avatar: string;
                updatedAt: any;
            }[]
        >(
            Prisma.sql`
                SELECT phone_messages_conversations.id,
                       phone_messages_conversations.unread,
                       phone_messages_conversations.conversation_id,
                       phone_messages_conversations.masked,
                       phone_messages_conversations.participant_identifier,
                       phone_profile.avatar,
                       phone_messages_conversations.updatedAt
                FROM phone_messages_conversations
                         LEFT OUTER JOIN phone_profile
                                         ON phone_profile.number = phone_messages_conversations.participant_identifier
                WHERE phone_messages_conversations.device_id = ${device.id}
                  AND phone_messages_conversations.updatedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                ORDER BY phone_messages_conversations.updatedAt DESC
            `
        );

        return conversations.map(
            conversation =>
                ({
                    id: conversation.id,
                    unread: conversation.unread,
                    conversation_id: conversation.conversation_id,
                    masked: conversation.masked === 1,
                    phoneNumber: conversation.participant_identifier,
                    avatar: conversation.avatar,
                    updatedAt: Number(conversation.updatedAt),
                }) as MessageConversation
        );
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_MESSAGES_CONVERSATION_ADD)
    async createConversation(source: number, phoneNumber: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device?.simNumber || phoneNumber === device.simNumber) {
            return;
        }

        const conversation = await this.upsertConversation(device.id, device.simNumber, phoneNumber);

        await this.notifyConversationReload(source, device.id);

        const target = await this.phoneDeviceService.findDeviceByNumber(phoneNumber);

        if (target && target.deviceId !== device.id) {
            await this.upsertConversation(target.deviceId, phoneNumber, device.simNumber);

            if (target.source && target.isMain) {
                await this.notifyConversationReload(target.source, target.deviceId);
            }
        }

        return conversation;
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_MESSAGES_CONVERSATION_SET_READ)
    async setConversationRead(source: number, conversationId: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        const conversation = await this.prismaService.phone_messages_conversations.findFirst({
            where: {
                conversation_id: conversationId,
                device_id: device.id,
            },
        });

        if (!conversation) {
            return;
        }

        await this.prismaService.phone_messages_conversations.updateMany({
            where: {
                conversation_id: conversationId,
                device_id: device.id,
            },
            data: {
                unread: 0,
                updatedAt: conversation.updatedAt,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_MESSAGES_CONVERSATION_ARCHIVE)
    async archiveConversation(source: number, conversationId: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return;
        }

        await this.prismaService.phone_messages_conversations.updateMany({
            where: {
                conversation_id: conversationId,
                device_id: device.id,
            },
            data: {
                masked: true,
            },
        });
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_MESSAGES_GET)
    async getMessages(source: number) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device) {
            return [];
        }

        const [messages, conversations] = await Promise.all([
            this.prismaService.phone_messages.findMany({
                select: {
                    id: true,
                    conversation_id: true,
                    message: true,
                    author: true,
                    createdAt: true,
                },
                where: {
                    device_id: device.id,
                },
                orderBy: {
                    id: 'desc',
                },
            }),
            this.prismaService.phone_messages_conversations.findMany({
                select: {
                    conversation_id: true,
                    participant_identifier: true,
                },
                where: {
                    device_id: device.id,
                },
            }),
        ]);

        const participants = new Map(
            conversations.map(conversation => [conversation.conversation_id, conversation.participant_identifier])
        );

        return messages.map(message => ({
            ...message,
            createdAt: Number(message.createdAt),
            isMine: message.author !== participants.get(message.conversation_id),
        }));
    }

    @Rpc(RpcServerEvent.PHONE_SIMCARD_MESSAGES_SEND)
    async sendMessage(source: number, conversationId: string, message: string) {
        const device = this.phoneDeviceService.getUnlockedDevice(source);

        if (!device?.simNumber) {
            return;
        }

        const conversation = await this.prismaService.phone_messages_conversations.findFirst({
            where: {
                conversation_id: conversationId,
                device_id: device.id,
            },
        });

        if (!conversation) {
            return;
        }

        const createdMessage = await this.prismaService.phone_messages.create({
            data: {
                device_id: device.id,
                user_identifier: '',
                author: device.simNumber,
                conversation_id: conversation.conversation_id,
                message,
            },
        });

        await this.prismaService.phone_messages_conversations.update({
            where: {
                id: conversation.id,
            },
            data: {
                masked: false,
                updatedAt: new Date(),
                user_identifier: device.simNumber,
            },
        });

        this.notifyNewMessage(source, device.id, createdMessage, true);

        const target = await this.phoneDeviceService.findDeviceByNumber(conversation.participant_identifier);

        if (!target || target.deviceId === device.id) {
            return;
        }

        const targetConversation = await this.upsertConversation(
            target.deviceId,
            conversation.participant_identifier,
            device.simNumber
        );

        const targetMessage = await this.prismaService.phone_messages.create({
            data: {
                device_id: target.deviceId,
                user_identifier: '',
                author: device.simNumber,
                conversation_id: targetConversation.conversation_id,
                message,
            },
        });

        await this.prismaService.phone_messages_conversations.update({
            where: {
                id: targetConversation.id,
            },
            data: {
                unread: {
                    increment: 1,
                },
            },
        });

        if (target.source && target.isMain) {
            this.notifyNewMessage(target.source, target.deviceId, targetMessage, false);
        }
    }

    private async upsertConversation(deviceId: string, ownNumber: string, participantNumber: string) {
        const existing = await this.prismaService.phone_messages_conversations.findFirst({
            where: {
                device_id: deviceId,
                participant_identifier: participantNumber,
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });

        if (existing) {
            await this.prismaService.phone_messages_conversations.update({
                where: {
                    id: existing.id,
                },
                data: {
                    masked: false,
                    updatedAt: new Date(),
                    user_identifier: ownNumber,
                },
            });

            return existing;
        }

        return this.prismaService.phone_messages_conversations.create({
            data: {
                device_id: deviceId,
                conversation_id: [ownNumber, participantNumber].sort().join('+'),
                user_identifier: ownNumber,
                participant_identifier: participantNumber,
            },
        });
    }

    private notifyNewMessage(source: number, deviceId: string, message: { createdAt: Date }, isMine: boolean) {
        TriggerClientEvent(ClientEvent.PHONE_SIMCARD_MESSAGES_MESSAGE_NEW, source, {
            ...message,
            createdAt: Number(message.createdAt),
            device_id: deviceId,
            isMine,
        });
    }

    private async notifyConversationReload(source: number, deviceId: string) {
        TriggerClientEvent(ClientEvent.PHONE_SIMCARD_MESSAGES_CONVERSATION_RELOAD, source, deviceId);
    }
}
