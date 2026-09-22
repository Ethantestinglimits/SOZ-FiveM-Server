import { CriminalityService } from '@private/client/criminality/criminality.service';
import { GangService } from '@private/client/gang/gang.service';
import { OnEvent, Once, OnceStep, OnNuiEvent } from '@public/core/decorators/event';
import { Inject } from '@public/core/decorators/injectable';
import { Provider } from '@public/core/decorators/provider';
import { emitRpc } from '@public/core/rpc';
import { ClientEvent, NuiEvent, ServerEvent } from '@public/shared/event';
import {
    GRAFFITI_ANCHOR_MODEL,
    GRAFFITI_CLEAN_DURATION,
    GRAFFITI_HEIGHT,
    GRAFFITI_NPC_MODEL,
    GRAFFITI_NPC_POSITION,
    GRAFFITI_TAG_ANIMATION,
    GRAFFITI_WIDTH,
    GraffitiMenuEntry,
} from '@public/shared/graffiti';
import { InventoryItem } from '@public/shared/inventory';
import { FDO_NO_FBI } from '@public/shared/job';
import { HttpLinkValidator } from '@public/shared/nui/input';
import { MenuType } from '@public/shared/nui/menu';
import { ObjectEditorOptions, WorldObject } from '@public/shared/object';
import { Zone } from '@public/shared/polyzone/box.zone';
import { toVector4Object, Vector3, Vector4 } from '@public/shared/polyzone/vector';
import { RpcServerEvent } from '@public/shared/rpc';

import { PedFactory } from '../factory/ped.factory';
import { InputService } from '../nui/input.service';
import { NuiMenu } from '../nui/nui.menu';
import { ObjectEditorProvider } from '../object/object.editor.provider';
import { ObjectProvider } from '../object/object.provider';
import { TextureReplacerProvider } from '../object/texture.replacer.provider';
import { PlayerService } from '../player/player.service';
import { ProgressService } from '../progress.service';
import { TargetFactory } from '../target/target.factory';
import { GraffitiRenderProvider } from './graffiti.render.provider';

@Provider()
export class GraffitiProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(ObjectProvider)
    private objectProvider: ObjectProvider;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(InputService)
    private inputService: InputService;

    @Inject(ProgressService)
    private progressService: ProgressService;

    @Inject(PedFactory)
    private pedFactory: PedFactory;

    @Inject(NuiMenu)
    private nuiMenu: NuiMenu;

    @Inject(GangService)
    private gangService: GangService;

    @Inject(CriminalityService)
    private criminalityService: CriminalityService;

    @Inject(ObjectEditorProvider)
    private objectEditorProvider: ObjectEditorProvider;

    @Inject(TextureReplacerProvider)
    private textureReplacerProvider: TextureReplacerProvider;

    @Inject(GraffitiRenderProvider)
    private graffitiRenderProvider: GraffitiRenderProvider;

    @OnEvent(ClientEvent.GRAFFITI_PLACE_ITEM)
    public async placeGraffitiItem(inventoryItem: InventoryItem) {
        const imageUrl = await this.inputService.askInput(
            {
                title: "URL de l'image du tag (facultatif, laissez vide pour l'ajouter plus tard)",
            },
            HttpLinkValidator
        );

        const position = await this.runGraffitiPlacementEditor(GetHashKey(GRAFFITI_ANCHOR_MODEL), imageUrl);
        if (!position) {
            return;
        }

        TriggerServerEvent(ServerEvent.GRAFFITI_PLACE, position, inventoryItem, imageUrl || null);
    }

    private async moveGraffiti(objectId: string) {
        const existingObject = this.objectProvider.getObject(objectId);
        if (!existingObject) {
            return;
        }

        const position = await this.runGraffitiPlacementEditor(
            existingObject.model,
            existingObject.metadata?.imageUrl || null,
            existingObject
        );
        if (!position) {
            return;
        }

        TriggerServerEvent(ServerEvent.GRAFFITI_MOVE, objectId, position);
    }

    private async runGraffitiPlacementEditor(
        model: number,
        imageUrl: string | null,
        existingObject: WorldObject | null = null
    ): Promise<Vector4 | null> {
        if (imageUrl) {
            this.textureReplacerProvider.loadTexture(imageUrl);
        }

        const options: Partial<ObjectEditorOptions> = {
            snapToGround: false,
            allowScale: false,
            maxDistance: 8,
            onDrawCallback: current => {
                if (imageUrl && this.textureReplacerProvider.isTextureLoaded(imageUrl)) {
                    this.graffitiRenderProvider.drawGraffiti(current.position, imageUrl);
                }
            },
        };

        if (!existingObject) {
            const ped = PlayerPedId();
            const position = GetOffsetFromEntityInWorldCoords(ped, 0, 2.0, 0) as Vector3;
            options.initialPosition = [position[0], position[1], position[2], GetEntityHeading(ped)];
        }

        const object = await this.objectEditorProvider.createOrUpdateObject(model, options, existingObject);

        if (!object) {
            return null;
        }

        if (!(await this.objectEditorProvider.checkPlacementPosition(object.position))) {
            return null;
        }

        return object.position;
    }

    private async removeGraffiti(objectId: string) {
        const progress = await this.progressService.progress(
            'graffiti_remove',
            'Nettoyage en cours...',
            GRAFFITI_CLEAN_DURATION,
            GRAFFITI_TAG_ANIMATION
        );

        if (!progress.completed) {
            return;
        }

        TriggerServerEvent(ServerEvent.GRAFFITI_REMOVE, objectId);
    }

    private isOwnTag(objectId: string): boolean {
        const player = this.playerService.getPlayer();
        const object = this.objectProvider.getObject(objectId);
        if (!player || !object) {
            return false;
        }

        if (player.gang?.id && player.gang.id === object.metadata?.gangId) {
            return true;
        }

        return !!object.metadata?.ownerId && player.citizenid === object.metadata.ownerId;
    }

    private registerGraffitiTarget(objectId: string) {
        const object = this.objectProvider.getObject(objectId);
        if (!object) {
            return;
        }

        const zone: Zone<any> = {
            center: [object.position[0], object.position[1], object.position[2] + GRAFFITI_HEIGHT / 2],
            heading: object.position[3],
            width: GRAFFITI_WIDTH,
            length: 1.0,
            minZ: object.position[2] - 0.3,
            maxZ: object.position[2] + GRAFFITI_HEIGHT + 0.3,
        };

        this.targetFactory.createForBoxZone(
            objectId,
            zone,
            [
                {
                    label: 'Peindre le tag',
                    category: 'criminal',
                    order: '1',
                    canInteract: () => this.isOwnTag(objectId),
                    action: async () => {
                        const imageUrl = await this.inputService.askInput(
                            {
                                title: "URL de l'image du tag",
                            },
                            HttpLinkValidator
                        );

                        if (!imageUrl) {
                            return;
                        }

                        TriggerServerEvent(ServerEvent.GRAFFITI_SET_IMAGE, objectId, imageUrl);
                    },
                },
                {
                    label: 'Déplacer le tag',
                    category: 'criminal',
                    order: '2',
                    canInteract: () => this.isOwnTag(objectId),
                    action: () => this.moveGraffiti(objectId),
                },
                {
                    label: 'Retirer le tag',
                    category: 'criminal',
                    order: '3',
                    canInteract: () => this.isOwnTag(objectId),
                    action: () => this.removeGraffiti(objectId),
                },
                {
                    label: 'Nettoyer le tag',
                    category: 'society',
                    order: '4',
                    canInteract: () => {
                        const player = this.playerService.getPlayer();
                        const isPolice = FDO_NO_FBI.includes(player.job.id) && player.job.onduty;

                        return isPolice || this.gangService.isHC() || this.criminalityService.isMediumCriminality();
                    },
                    action: () => this.removeGraffiti(objectId),
                },
            ],
            2.5
        );
    }

    @OnEvent(ClientEvent.OBJECT_SPAWN)
    public onGraffitiSpawn(objectId: string) {
        if (!objectId.startsWith('graffiti_')) {
            return;
        }

        this.registerGraffitiTarget(objectId);
    }

    @OnEvent(ClientEvent.OBJECT_DESPAWN)
    public onGraffitiDespawn(objectId: string) {
        if (!objectId.startsWith('graffiti_')) {
            return;
        }

        this.targetFactory.removeBoxZone(objectId);
    }

    @Once(OnceStep.PlayerLoaded)
    public async spawnGraffitiNpc() {
        await this.pedFactory.createPedOnGrid({
            model: GRAFFITI_NPC_MODEL,
            coords: toVector4Object(GRAFFITI_NPC_POSITION),
            freeze: true,
            invincible: true,
            blockevents: true,
            scenario: 'WORLD_HUMAN_STAND_IMPATIENT',
        });

        this.targetFactory.createForModel(
            [GetHashKey(GRAFFITI_NPC_MODEL)],
            [
                {
                    label: 'Gérer les graffitis',
                    category: 'criminal',
                    canInteract: () => !!this.playerService.getPlayer()?.gang?.id,
                    action: () => this.openGraffitiManageMenu(),
                },
            ],
            2.5
        );
    }

    private async openGraffitiManageMenu() {
        const tags = await emitRpc<GraffitiMenuEntry[]>(RpcServerEvent.GRAFFITI_GET_GANG_LIST);

        this.nuiMenu.openMenu(MenuType.GraffitiManageMenu, { tags });
    }

    @OnNuiEvent(NuiEvent.GraffitiManageRemove)
    public async onGraffitiManageRemove({ id }: { id: string }): Promise<void> {
        TriggerServerEvent(ServerEvent.GRAFFITI_REMOVE, id);
        this.nuiMenu.closeMenu();
    }
}
