import { CriminalityService } from '@private/client/criminality/criminality.service';
import { GangService } from '@private/client/gang/gang.service';
import { Once, OnceStep, OnNuiEvent } from '@public/core/decorators/event';
import { Inject } from '@public/core/decorators/injectable';
import { Provider } from '@public/core/decorators/provider';
import { emitRpc } from '@public/core/rpc';
import { NuiEvent, ServerEvent } from '@public/shared/event';
import {
    GRAFFITI_ANCHOR_MODEL,
    GRAFFITI_CLEAN_DURATION,
    GRAFFITI_NPC_MODEL,
    GRAFFITI_NPC_POSITION,
    GRAFFITI_TAG_ANIMATION,
    GraffitiMenuEntry,
} from '@public/shared/graffiti';
import { FDO_NO_FBI } from '@public/shared/job';
import { HttpLinkValidator } from '@public/shared/nui/input';
import { MenuType } from '@public/shared/nui/menu';
import { toVector4Object } from '@public/shared/polyzone/vector';
import { RpcServerEvent } from '@public/shared/rpc';

import { PedFactory } from '../factory/ped.factory';
import { InputService } from '../nui/input.service';
import { NuiMenu } from '../nui/nui.menu';
import { ObjectProvider } from '../object/object.provider';
import { PlayerService } from '../player/player.service';
import { ProgressService } from '../progress.service';
import { TargetFactory } from '../target/target.factory';

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

    private async removeGraffiti(entity: number) {
        const objectId = this.objectProvider.getIdFromEntity(entity);
        if (!objectId) {
            return;
        }

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

    private isOwnGangTag(entity: number): boolean {
        const player = this.playerService.getPlayer();
        const objectId = this.objectProvider.getIdFromEntity(entity);
        const object = objectId ? this.objectProvider.getObject(objectId) : null;

        return !!player?.gang?.id && object?.metadata?.gangId === player.gang.id;
    }

    @Once()
    public registerTargets() {
        this.targetFactory.createForModel(
            [GetHashKey(GRAFFITI_ANCHOR_MODEL)],
            [
                {
                    label: 'Peindre le tag',
                    category: 'criminal',
                    canInteract: entity => this.isOwnGangTag(entity),
                    action: async entity => {
                        const objectId = this.objectProvider.getIdFromEntity(entity);
                        if (!objectId) {
                            return;
                        }

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
                    label: 'Retirer le tag',
                    category: 'criminal',
                    canInteract: entity => this.isOwnGangTag(entity),
                    action: entity => this.removeGraffiti(entity),
                },
                {
                    label: 'Nettoyer le tag',
                    category: 'society',
                    canInteract: () => {
                        const player = this.playerService.getPlayer();
                        const isPolice = FDO_NO_FBI.includes(player.job.id) && player.job.onduty;

                        return isPolice || this.gangService.isHC() || this.criminalityService.isMediumCriminality();
                    },
                    action: entity => this.removeGraffiti(entity),
                },
            ],
            2.5
        );
    }

    /**
     * A stand-in for the real gang business/storage NPC (not part of this checkout - it lives in
     * the private overlay). Model and position are placeholders, see GRAFFITI_NPC_MODEL/POSITION.
     */
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
    public onGraffitiManageRemove({ id }: { id: string }) {
        TriggerServerEvent(ServerEvent.GRAFFITI_REMOVE, id);
        this.nuiMenu.closeMenu();
    }
}
