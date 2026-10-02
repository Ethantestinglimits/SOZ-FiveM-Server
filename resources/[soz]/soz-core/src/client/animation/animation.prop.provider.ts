import { Once, OnceStep, OnEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { emitRpc } from '@core/rpc';
import { wait } from '@core/utils';
import {
    PROP_ANIMATION_LABEL_MAX_LENGTH,
    PROP_ANIMATION_MAX_OFFSET,
    PropAnimation,
    PropAnimationItem,
} from '@public/shared/animation';
import { ClientEvent } from '@public/shared/event';
import { NotEmptyStringValidator } from '@public/shared/nui/input';
import { getDistance, Vector3, Vector4 } from '@public/shared/polyzone/vector';
import { RpcServerEvent } from '@public/shared/rpc';
import { TargetOption } from '@public/shared/target';

import { AdminPermissionService } from '../admin/admin.permission.service';
import { Notifier } from '../notifier';
import { InputService } from '../nui/input.service';
import { PlayerAnimationProvider } from '../player/player.animation.provider';
import { PlayerService } from '../player/player.service';
import { TargetProvider } from '../target/target.provider';
import { AnimationFactory, AnimationRunner } from './animation.factory';
import { AnimationService } from './animation.service';
import { WorldAnimationPreviewService } from './animation.world.preview.service';

const GROUP = 'Animations enregistrées';
const DELETE_GROUP = `${GROUP}/Supprimer`;
// Portée des options (enregistrer, jouer, supprimer) autour du prop
const DISTANCE = 3.0;

// GetEntityModel peut renvoyer le hash non signé: on le ramène en entier signé 32 bits, comme en base
const toModel = (entity: number): number => GetEntityModel(entity) | 0;

const normalizeHeading = (heading: number): number => ((heading % 360) + 360) % 360;

/**
 * Animations du menu enregistrées par les joueurs sur un modèle de prop: un joueur joue une animation, la cale au besoin
 * ("Déplacer l'animation"), puis l'enregistre sur le prop depuis le menu contextuel. Tous les props de ce modèle la
 * proposent ensuite, avec un aperçu au survol.
 */
@Provider()
export class AnimationPropProvider {
    @Inject(TargetProvider)
    private targetProvider: TargetProvider;

    @Inject(PlayerAnimationProvider)
    private playerAnimationProvider: PlayerAnimationProvider;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(AnimationFactory)
    private animationFactory: AnimationFactory;

    @Inject(WorldAnimationPreviewService)
    private worldAnimationPreviewService: WorldAnimationPreviewService;

    @Inject(AdminPermissionService)
    private adminPermissionService: AdminPermissionService;

    @Inject(InputService)
    private inputService: InputService;

    @Inject(Notifier)
    private notifier: Notifier;

    private animations = new Map<number, PropAnimation>();

    private playing = false;

    @Once(OnceStep.Start)
    public onStart(): void {
        this.targetProvider.registerObjectOptions((object, coords) => this.buildOptions(object, coords));
    }

    @Once(OnceStep.PlayerLoaded)
    public async loadAnimations(): Promise<void> {
        const animations = await emitRpc<PropAnimation[]>(RpcServerEvent.PROP_ANIMATION_GET_ALL);

        this.animations = new Map(animations.map(animation => [animation.id, animation]));
    }

    @OnEvent(ClientEvent.PROP_ANIMATION_ADDED)
    public onAdded(animation: PropAnimation): void {
        this.animations.set(animation.id, animation);
    }

    @OnEvent(ClientEvent.PROP_ANIMATION_DELETED)
    public onDeleted(id: number): void {
        this.animations.delete(id);
    }

    private async buildOptions(object: number, coords: Vector3): Promise<TargetOption[]> {
        const playerCoords = GetEntityCoords(PlayerPedId()) as Vector3;
        const distance = Math.min(
            getDistance(playerCoords, coords),
            getDistance(playerCoords, GetEntityCoords(object) as Vector3)
        );

        if (distance > DISTANCE) {
            return [];
        }

        const model = toModel(object);
        const saved = [...this.animations.values()].filter(animation => animation.model === model);
        const options: TargetOption[] = [];

        for (const animation of saved) {
            options.push({
                label: animation.label,
                category: 'citizen',
                group: GROUP,
                order: `${GROUP}/1-${animation.label}`,
                distance: DISTANCE,
                action: entity => this.play(entity, animation),
                preview: entity => this.preview(entity, animation),
            });
        }

        const running = this.playerAnimationProvider.getRunningMenuAnimation();

        if (running) {
            options.push({
                label: 'Enregistrer mon animation ici',
                category: 'citizen',
                group: GROUP,
                order: `${GROUP}/0`,
                distance: DISTANCE,
                action: entity => this.save(entity, running),
            });
        }

        const citizenId = this.playerService.getPlayer()?.citizenid;
        const permission = saved.some(animation => animation.citizenId !== citizenId)
            ? await this.adminPermissionService.getPermission()
            : null;

        for (const animation of saved) {
            if (animation.citizenId !== citizenId && !permission) {
                continue;
            }

            options.push({
                label: animation.label,
                subLabel: animation.citizenId === citizenId ? undefined : animation.creatorName,
                category: 'citizen',
                group: DELETE_GROUP,
                order: `${GROUP}/2-${animation.label}`,
                distance: DISTANCE,
                action: () => this.delete(animation),
            });
        }

        return options;
    }

    // Position du ped dans le repère du prop, pour la retrouver sur n'importe quel prop du même modèle
    private getOffset(entity: number): Vector4 {
        const ped = PlayerPedId();
        const [x, y, z] = GetEntityCoords(ped, true) as Vector3;
        const [ox, oy, oz] = GetOffsetFromEntityGivenWorldCoords(entity, x, y, z) as Vector3;

        return [ox, oy, oz, normalizeHeading(GetEntityHeading(ped) - GetEntityHeading(entity))];
    }

    private getWorldPosition(entity: number, offset: Vector4): Vector4 {
        const [x, y, z] = GetOffsetFromEntityInWorldCoords(entity, offset[0], offset[1], offset[2]) as Vector3;

        return [x, y, z, normalizeHeading(GetEntityHeading(entity) + offset[3])];
    }

    private async save(entity: number, animation: PropAnimationItem): Promise<void> {
        // Relevée tout de suite: le joueur est encore dans sa pose, la saisie du nom prend du temps
        const offset = this.getOffset(entity);
        const model = toModel(entity);

        if (Math.hypot(offset[0], offset[1], offset[2]) > PROP_ANIMATION_MAX_OFFSET) {
            this.notifier.error('Vous êtes trop loin du prop pour y enregistrer votre animation.');

            return;
        }

        // Le menu contextuel se ferme juste après l'action et rend le focus: la saisie s'ouvre une fois qu'il l'a rendu
        await wait(200);

        const label = await this.inputService.askInput(
            {
                title: "Nom de l'animation",
                maxCharacters: PROP_ANIMATION_LABEL_MAX_LENGTH,
                defaultValue: animation.name,
            },
            NotEmptyStringValidator
        );

        if (!label) {
            return;
        }

        const result = await emitRpc<{ ok: boolean; error?: string }>(
            RpcServerEvent.PROP_ANIMATION_SAVE,
            model,
            label,
            animation,
            offset
        );

        if (result.ok) {
            this.notifier.notify(`Animation « ${label.trim()} » enregistrée sur ce prop.`, 'success');
        } else {
            this.notifier.error(result.error ?? "L'animation n'a pas pu être enregistrée.");
        }
    }

    private async delete(animation: PropAnimation): Promise<void> {
        const deleted = await emitRpc<boolean>(RpcServerEvent.PROP_ANIMATION_DELETE, animation.id);

        if (deleted) {
            this.notifier.notify(`Animation « ${animation.label} » supprimée.`, 'success');
        } else {
            this.notifier.error("L'animation n'a pas pu être supprimée.");
        }
    }

    private startAnimation(animation: PropAnimationItem, ped?: number): AnimationRunner {
        if (animation.type === 'animation') {
            return ped
                ? this.animationFactory.createAnimation(
                      { props: animation.animation.props, base: animation.animation.base },
                      { ped }
                  )
                : this.animationService.playAnimation(animation.animation);
        }

        const scenario = { ...animation.scenario, position: undefined };

        return ped
            ? this.animationFactory.createScenario({ ...scenario, playEnterAnim: false }, { ped })
            : this.animationService.playScenario(scenario);
    }

    private preview(entity: number, animation: PropAnimation): () => void {
        const [x, y, z, heading] = this.getWorldPosition(entity, animation.offset);

        return this.worldAnimationPreviewService.start(ghost => {
            SetEntityCoordsNoOffset(ghost, x, y, z, false, false, false);
            SetEntityHeading(ghost, heading);
            // Sans collision, la pose (assise...) le ferait sinon tomber à travers le prop
            FreezeEntityPosition(ghost, true);

            return this.startAnimation(animation.animation, ghost);
        });
    }

    // Même principe que "Déplacer l'animation": l'animation est lancée, puis le ped est posé à l'endroit enregistré et
    // figé; il revient là où il était une fois l'animation terminée.
    private async play(entity: number, animation: PropAnimation): Promise<void> {
        if (this.playing) {
            return;
        }

        this.playing = true;

        try {
            const ped = PlayerPedId();

            await this.animationService.stop();
            // Une animation calée précédemment renvoie le ped à son point de départ en se terminant
            await wait(250);

            if (!DoesEntityExist(entity)) {
                return;
            }

            const startCoords = GetEntityCoords(ped, true) as Vector3;
            const startHeading = GetEntityHeading(ped);
            const [x, y, z, heading] = this.getWorldPosition(entity, animation.offset);

            let ended = false;
            const runner = this.startAnimation(animation.animation);

            runner.finally(() => {
                ended = true;
                FreezeEntityPosition(ped, false);
                SetEntityCoordsNoOffset(ped, startCoords[0], startCoords[1], startCoords[2], true, true, true);
                SetEntityHeading(ped, startHeading);
            });

            // Un scénario peut replacer le ped juste après son lancement: on attend qu'il soit en place
            await this.waitForPedToStabilize(ped);

            if (ended) {
                return;
            }

            FreezeEntityPosition(ped, true);
            SetEntityCoordsNoOffset(ped, x, y, z, true, true, true);
            SetEntityHeading(ped, heading);
        } finally {
            this.playing = false;
        }
    }

    private async waitForPedToStabilize(ped: number): Promise<void> {
        const deadline = GetGameTimer() + 2000;
        let lastCoords = GetEntityCoords(ped) as Vector3;

        while (GetGameTimer() < deadline) {
            await wait(150);

            const coords = GetEntityCoords(ped) as Vector3;

            if (getDistance(coords, lastCoords) < 0.01) {
                return;
            }

            lastCoords = coords;
        }
    }
}
