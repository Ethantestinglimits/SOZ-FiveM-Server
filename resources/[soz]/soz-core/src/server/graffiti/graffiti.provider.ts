import { CriminalityService } from '@private/server/criminality/criminality.service';
import { GangService } from '@private/server/gang/gang.service';
import { On, Once, OnceStep, OnEvent } from '@public/core/decorators/event';
import { Inject } from '@public/core/decorators/injectable';
import { Provider } from '@public/core/decorators/provider';
import { uuidv4 } from '@public/core/utils';
import { ClientEvent, ServerEvent } from '@public/shared/event';
import { Feature } from '@public/shared/features';
import {
    GRAFFITI_ANCHOR_MODEL,
    GRAFFITI_ITEM,
    GRAFFITI_MAX_PER_GANG,
    GRAFFITI_PLACE_DURATION,
    GRAFFITI_SPRAY_CAN_PROP,
    GRAFFITI_TAG_ANIMATION,
    GraffitiMenuEntry,
} from '@public/shared/graffiti';
import { InventoryItem } from '@public/shared/inventory';
import { Item } from '@public/shared/item';
import { FDO_NO_FBI } from '@public/shared/job';
import { WorldObject } from '@public/shared/object';
import { fromVector4Object, getDistance, toVector4Object, Vector3, Vector4 } from '@public/shared/polyzone/vector';
import { RpcServerEvent } from '@public/shared/rpc';
import axios from 'axios';

import { Command } from '../../core/decorators/command';
import { Rpc } from '../../core/decorators/rpc';
import { PrismaService } from '../database/prisma.service';
import { FeatureProvider } from '../feature/feature.provider';
import { InventoryFactory } from '../inventory/inventory.factory';
import { ItemService } from '../item/item.service';
import { Monitor } from '../monitor/monitor';
import { Notifier } from '../notifier';
import { ObjectProvider } from '../object/object.provider';
import { PermissionService } from '../permission.service';
import { PhoneAppSocietyProvider } from '../phone/apps/phone.app.society.provider';
import { PlayerService } from '../player/player.service';
import { ProgressService } from '../player/progress.service';

@Provider()
export class GraffitiProvider {
    @Inject(ItemService)
    private readonly itemService: ItemService;

    @Inject(PlayerService)
    private readonly playerService: PlayerService;

    @Inject(ProgressService)
    private readonly progressService: ProgressService;

    @Inject(ObjectProvider)
    private readonly objectProvider: ObjectProvider;

    @Inject(Notifier)
    private readonly notifier: Notifier;

    @Inject(InventoryFactory)
    private readonly inventory: InventoryFactory;

    @Inject(Monitor)
    private readonly monitor: Monitor;

    @Inject(PrismaService)
    private prismaService: PrismaService;

    @Inject(PermissionService)
    private permissionService: PermissionService;

    @Inject(FeatureProvider)
    private featureProvider: FeatureProvider;

    @Inject(PhoneAppSocietyProvider)
    private phoneSocietyProvider: PhoneAppSocietyProvider;

    @Inject(GangService)
    private gangService: GangService;

    @Inject(CriminalityService)
    private criminalityService: CriminalityService;

    private usedSlotByGang = new Map<number, string[]>();

    // Populated by /graffiti_list, consumed by /graffiti_remove <index> so players don't have to
    // type a full graffiti id in chat.
    private lastListedByPlayer = new Map<number, string[]>();

    @Once()
    public init() {
        this.itemService.setItemUseCallback(GRAFFITI_ITEM, this.useGraffiti.bind(this));
    }

    @Once(OnceStep.DatabaseConnected)
    public async onDatabaseConnected() {
        const graffitis = await this.prismaService.dynamic_prop_graffiti.findMany();

        for (const graffiti of graffitis) {
            const object: WorldObject = {
                id: graffiti.id,
                model: GetHashKey(GRAFFITI_ANCHOR_MODEL),
                position: fromVector4Object(JSON.parse(graffiti.position)),
                permanent: false,
                metadata: {
                    gangId: graffiti.gangId,
                    imageUrl: graffiti.imageUrl,
                },
            };

            this.objectProvider.createObject(object);

            this.getSlotsForGang(graffiti.gangId).push(graffiti.id);
        }
    }

    private getSlotsForGang(gangId: number): string[] {
        let slots = this.usedSlotByGang.get(gangId);
        if (!slots) {
            slots = [];
            this.usedSlotByGang.set(gangId, slots);
        }
        return slots;
    }

    private async sendGraffitiPoliceAlert(source: number, position: Vector4): Promise<void> {
        if (!this.featureProvider.isFeatureEnabled(Feature.PoliceAlert)) {
            return;
        }

        await this.phoneSocietyProvider.sendMessage(source, {
            anonymous: true,
            position: false,
            number: '555-POLICE',
            message: 'Un individu est en train de taguer un mur.',
            htmlMessage: 'Un individu est en train de <span {class}>taguer un mur</span>.',
            type: 'vandalism',
            overrideIdentifier: 'System',
            pedPosition: { coords: [position[0], position[1], position[2]] },
        });
    }

    private async useGraffiti(source: number, item: Item, inventoryItem: InventoryItem) {
        const player = this.playerService.getPlayer(source);
        if (!player || !player.gang?.id) {
            this.notifier.error(source, "Vous devez appartenir à un gang pour utiliser cet objet.");
            return;
        }

        if (this.getSlotsForGang(player.gang.id).length >= GRAFFITI_MAX_PER_GANG) {
            this.notifier.error(source, 'Votre gang a atteint le nombre maximum de tags posés.');
            return;
        }

        TriggerClientEvent(
            ClientEvent.OBJECT_PLACE_ITEM,
            source,
            ServerEvent.GRAFFITI_PLACE,
            GRAFFITI_ANCHOR_MODEL,
            inventoryItem,
            false,
            true
        );
    }

    @OnEvent(ServerEvent.GRAFFITI_PLACE)
    public async placeGraffiti(source: number, position: Vector4, inventoryItem: InventoryItem) {
        const playerStartingTag = this.playerService.getPlayer(source);
        if (!playerStartingTag || !playerStartingTag.gang?.id) {
            return;
        }

        await this.sendGraffitiPoliceAlert(source, position);

        const progress = await this.progressService.progress(
            source,
            'graffiti_use',
            'Tag en cours...',
            GRAFFITI_PLACE_DURATION,
            GRAFFITI_TAG_ANIMATION,
            { firstProp: GRAFFITI_SPRAY_CAN_PROP }
        );

        if (!progress.completed) {
            return;
        }

        const player = this.playerService.getPlayer(source);
        if (!player || !player.gang?.id) {
            return;
        }

        const slots = this.getSlotsForGang(player.gang.id);
        if (slots.length >= GRAFFITI_MAX_PER_GANG) {
            this.notifier.error(source, 'Votre gang a atteint le nombre maximum de tags posés.');
            return;
        }

        const inventory = await this.inventory.getPlayerInventory(source);
        if (!inventory.removeAtSlot(inventoryItem.slot, 1)) {
            this.notifier.error(source, `Il vous manque un ~b~${inventoryItem.name}~s~.`);
            return;
        }

        const objectId = `graffiti_${uuidv4()}`;

        await this.prismaService.dynamic_prop_graffiti.create({
            data: {
                id: objectId,
                gangId: player.gang.id,
                position: JSON.stringify(toVector4Object(position)),
                createdAt: new Date(),
            },
        });

        slots.push(objectId);

        const object: WorldObject = {
            id: objectId,
            model: GetHashKey(GRAFFITI_ANCHOR_MODEL),
            position,
            permanent: false,
            metadata: {
                gangId: player.gang.id,
            },
        };

        this.objectProvider.createObject(object);

        this.monitor.traceEvent('graffiti_placement', {
            id: object.id,
            player_source: source,
            gang_id: player.gang.id,
        });
    }

    @OnEvent(ServerEvent.GRAFFITI_SET_IMAGE)
    public async setGraffitiImage(source: number, objectId: string, imageUrl: string): Promise<void> {
        const object = this.objectProvider.getObject(objectId);
        if (!object) {
            return;
        }

        const player = this.playerService.getPlayer(source);
        if (!player || player.gang?.id !== object.metadata?.gangId) {
            this.notifier.error(source, "Vous n'avez pas la permission de modifier ce tag.");
            return;
        }

        if (!this.permissionService.isStaff(source)) {
            try {
                const resp = await axios.get(imageUrl);
                if (resp.status != 200 && resp.status != 304) {
                    this.notifier.error(source, 'URL non valide');
                    return;
                }
                const contentType = resp.headers['content-type'] ?? resp.headers['Content-Type'];
                if (!contentType || !contentType.toString().startsWith('image')) {
                    this.notifier.error(source, `L'URL n'est pas une image`);
                    return;
                }
            } catch (e) {
                this.notifier.error(source, 'URL non valide');
                return;
            }
        }

        await this.prismaService.dynamic_prop_graffiti.update({
            where: { id: objectId },
            data: { imageUrl, updatedAt: new Date() },
        });

        object.metadata = { ...object.metadata, imageUrl };
        this.objectProvider.updateObject(object);

        this.monitor.traceEvent('graffiti_image_update', {
            id: objectId,
            player_source: source,
            message: imageUrl,
        });
    }

    @OnEvent(ServerEvent.GRAFFITI_REMOVE)
    public async removeGraffiti(source: number, objectId: string): Promise<void> {
        const object = this.objectProvider.getObject(objectId);
        if (!object) {
            return;
        }

        if (!(await this.canManageGraffiti(source, object))) {
            this.notifier.error(source, "Vous n'avez pas la permission de retirer ce tag.");
            return;
        }

        await this.deleteGraffiti(source, object);
    }

    /**
     * A gang's own tag can end up out of reach (placed inside a wall, or in an otherwise
     * unreachable spot), in which case the in-world target menu can't be used at all. These
     * commands are a fallback that don't require targeting the physical prop: /graffiti_list
     * shows what a player is allowed to manage (their own gang's tags, or every tag for on-duty
     * police/staff), and /graffiti_remove <numéro> removes one by the number it was just listed
     * under, reusing the exact same permission check as the target-menu removal.
     */
    @Command('graffiti_list', {
        description: 'Lister les tags que vous pouvez gérer (votre gang, ou tous si police/staff)',
    })
    public async listGraffitiCommand(source: number) {
        const player = this.playerService.getPlayer(source);
        if (!player) {
            return;
        }

        const isPolice = FDO_NO_FBI.includes(player.job.id) && player.job.onduty;
        const isStaff = this.permissionService.isStaff(source);
        const canSeeEveryGang = isPolice || isStaff;

        if (!canSeeEveryGang && !player.gang?.id) {
            this.notifier.error(source, "Vous devez appartenir à un gang pour utiliser cette commande.");
            return;
        }

        const graffitiAnchorModel = GetHashKey(GRAFFITI_ANCHOR_MODEL);
        const graffitis = this.objectProvider
            .getObjects()
            .filter(object => object.model === graffitiAnchorModel)
            .filter(object => canSeeEveryGang || object.metadata?.gangId === player.gang.id);

        if (graffitis.length === 0) {
            this.notifier.notify(source, 'Aucun tag trouvé.', 'info');
            return;
        }

        const playerPosition = GetEntityCoords(GetPlayerPed(source)) as Vector3;
        const sorted = graffitis
            .map(object => ({ object, distance: getDistance(playerPosition, object.position) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 20);

        this.lastListedByPlayer.set(
            source,
            sorted.map(entry => entry.object.id)
        );

        const lines = sorted.map((entry, index) => {
            const distance = `${Math.round(entry.distance)}m`;
            const status = entry.object.metadata?.imageUrl ? 'peint' : 'vide';
            const gang = canSeeEveryGang ? ` - gang #${entry.object.metadata?.gangId}` : '';

            return `#${index + 1} - ${distance}${gang} - ${status}`;
        });

        this.notifier.notify(
            source,
            `Tags gérables :~n~${lines.join('~n~')}~n~/graffiti_remove <numéro> pour en retirer un.`,
            'info',
            15000
        );
    }

    /**
     * Backs the dedicated graffiti-management NPC menu (client-side src/client/graffiti/graffiti.provider.ts):
     * unlike /graffiti_list, this is gang-members-only and never shows other gangs' tags, since it's
     * meant purely for self-service cleanup of your own gang's graffitis.
     */
    @Rpc(RpcServerEvent.GRAFFITI_GET_GANG_LIST)
    public async getGangGraffitiList(source: number): Promise<GraffitiMenuEntry[]> {
        const player = this.playerService.getPlayer(source);
        if (!player || !player.gang?.id) {
            return [];
        }

        const graffitiAnchorModel = GetHashKey(GRAFFITI_ANCHOR_MODEL);
        const graffitis = this.objectProvider
            .getObjects()
            .filter(object => object.model === graffitiAnchorModel && object.metadata?.gangId === player.gang.id);

        const playerPosition = GetEntityCoords(GetPlayerPed(source)) as Vector3;

        return graffitis
            .map(object => ({
                id: object.id,
                distance: getDistance(playerPosition, object.position),
                hasImage: !!object.metadata?.imageUrl,
            }))
            .sort((a, b) => a.distance - b.distance)
            .map(entry => ({
                id: entry.id,
                distanceLabel: `${Math.round(entry.distance)}m`,
                hasImage: entry.hasImage,
            }));
    }

    @Command('graffiti_remove', {
        description: 'Retirer un de vos tags par son numéro (/graffiti_list pour les lister)',
    })
    public async removeGraffitiCommand(source: number, index: number) {
        const list = this.lastListedByPlayer.get(source);
        const objectId = list?.[index - 1];
        if (!objectId) {
            this.notifier.error(source, "Numéro invalide, faites d'abord /graffiti_list.");
            return;
        }

        const object = this.objectProvider.getObject(objectId);
        if (!object) {
            this.notifier.error(source, 'Ce tag a déjà été retiré.');
            return;
        }

        if (!(await this.canManageGraffiti(source, object))) {
            this.notifier.error(source, "Vous n'avez pas la permission de retirer ce tag.");
            return;
        }

        await this.deleteGraffiti(source, object);
        this.notifier.notify(source, 'Tag retiré.', 'success');
    }

    @On('playerDropped')
    public onPlayerDropped(source: number) {
        this.lastListedByPlayer.delete(source);
    }

    private async canManageGraffiti(source: number, object: WorldObject): Promise<boolean> {
        const player = this.playerService.getPlayer(source);
        if (!player) {
            return false;
        }

        const isOwnGang = !!player.gang?.id && player.gang.id === object.metadata?.gangId;
        const isPolice = FDO_NO_FBI.includes(player.job.id) && player.job.onduty;

        if (isOwnGang || isPolice || this.permissionService.isStaff(source)) {
            return true;
        }

        return (await this.gangService.isHC(source)) || (await this.criminalityService.isMediumCriminality(source));
    }

    private async deleteGraffiti(source: number, object: WorldObject): Promise<void> {
        this.objectProvider.deleteObject(object.id);
        await this.prismaService.dynamic_prop_graffiti.delete({ where: { id: object.id } });

        const gangId = object.metadata?.gangId;
        if (gangId !== undefined) {
            const slots = this.getSlotsForGang(gangId);
            const index = slots.indexOf(object.id);
            if (index !== -1) {
                slots.splice(index, 1);
            }
        }

        this.monitor.traceEvent('graffiti_removed', {
            id: object.id,
            player_source: source,
        });
    }
}
