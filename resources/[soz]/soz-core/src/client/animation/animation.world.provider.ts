import { Animation, Scenario, WorldAnimationOption, WorldAnimationPlay } from '@public/shared/animation';
import { PlayerPedHash } from '@public/shared/player';
import { getDistance, Vector3, Vector4 } from '@public/shared/polyzone/vector';
import { TargetMode, TargetOption } from '@public/shared/target';

import { EntityConfig, EntitySeatLabels, WorldAnimationGroups } from '../../config/worldinterraction';
import { Once, OnceStep } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { PlayerService } from '../player/player.service';
import { TargetFactory } from '../target/target.factory';
import { AnimationFactory } from './animation.factory';
import { AnimationService } from './animation.service';
import { snapshotObjects, sweepDroppedObjects } from './animation.world.objects';
import { WorldAnimationPreviewService } from './animation.world.preview.service';

const SCENARIO_PROPS_SWEEP_DELAYS_MS = [0, 1000, 3000];

// Nom des places d'une rangée selon leur nombre, de gauche à droite
const SEAT_NAMES: Record<number, string[]> = {
    1: ['Place'],
    2: ['Place de gauche', 'Place de droite'],
    3: ['Place de gauche', 'Place du milieu', 'Place de droite'],
    4: ['Place de gauche', 'Place centre gauche', 'Place centre droit', 'Place de droite'],
};

@Provider()
export class SeatAnimationProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(AnimationFactory)
    private animationFactory: AnimationFactory;

    @Inject(WorldAnimationPreviewService)
    private worldAnimationPreviewService: WorldAnimationPreviewService;

    @Inject(PlayerService)
    private playerService: PlayerService;

    public Relative2Absolute(Ox: number, Oy: number, heading: number): [number, number] {
        heading = heading * (Math.PI / 180);
        const x = Ox * Math.cos(heading) - Oy * Math.sin(heading);
        const y = Ox * Math.sin(heading) + Oy * Math.cos(heading);
        return [x, y];
    }

    // Places d'un modèle dans l'ordre d'affichage: rangée par rangée (une rangée = même orientation), de gauche à
    // droite vu de face. Un modèle à une seule place n'en a pas: on s'y assoit sans choisir.
    private getSeats(model: number): { key: string; label: string }[] {
        const seats = Object.entries(EntityConfig[model] ?? {});
        if (seats.length < 2) {
            return [];
        }

        const rows = new Map<number, { key: string; left: number }[]>();

        for (const [key, [x, y, , heading]] of seats) {
            const facing = (((Math.round(heading / 90) * 90) % 360) + 360) % 360;
            const angle = heading * (Math.PI / 180);
            // La droite de la personne assise, soit la gauche de celui qui lui fait face
            const left = x * Math.cos(angle) + y * Math.sin(angle);

            rows.set(facing, [...(rows.get(facing) ?? []), { key, left }]);
        }

        const result: { key: string; label: string }[] = [];
        let rowIndex = 0;

        for (const row of rows.values()) {
            row.sort((a, b) => b.left - a.left);
            const names = SEAT_NAMES[row.length] ?? row.map((_, index) => `Place ${index + 1}`);
            const prefix = rows.size > 1 ? `Côté ${String.fromCharCode(65 + rowIndex)} · ` : '';

            row.forEach(({ key }, index) =>
                result.push({ key, label: EntitySeatLabels[model]?.[key] ?? `${prefix}${names[index]}` })
            );
            rowIndex++;
        }

        return result;
    }

    public calculateSeatPosition(entity: number, position: Vector3, seatKey?: string): Vector4 {
        const [Px, Py, Pz] = position;
        const [x, y, z] = GetEntityCoords(entity);
        let heading = GetEntityHeading(entity);
        if (heading >= 180) {
            heading = heading - 179;
        } else {
            heading = heading + 179;
        }

        let Offset: Vector4 = [0, 0, 0, 0];
        let x2 = 0.0,
            y2 = 0.0,
            BestDistance = 2.0;
        let BestSeat = '0';

        if (EntityConfig[GetEntityModel(entity)]) {
            if (seatKey !== undefined && EntityConfig[GetEntityModel(entity)][seatKey]) {
                Offset = EntityConfig[GetEntityModel(entity)][seatKey];
                [x2, y2] = this.Relative2Absolute(Offset[0], Offset[1], heading);
            } else if (Object.keys(EntityConfig[GetEntityModel(entity)]).length === 1) {
                Offset = EntityConfig[GetEntityModel(entity)][0];
                [x2, y2] = this.Relative2Absolute(Offset[0], Offset[1], heading);
            } else {
                for (const [key] of Object.entries(EntityConfig[GetEntityModel(entity)])) {
                    Offset = EntityConfig[GetEntityModel(entity)][key];
                    [x2, y2] = this.Relative2Absolute(Offset[0], Offset[1], heading);
                    const distance = getDistance([Px, Py, Pz], [x + x2, y + y2, z]);
                    if (distance < BestDistance) {
                        BestDistance = distance;
                        BestSeat = key;
                    }
                }
                Offset = EntityConfig[GetEntityModel(entity)][BestSeat];
                [x2, y2] = this.Relative2Absolute(Offset[0], Offset[1], heading);
            }
        }
        return [x + x2, y + y2, z + Offset[2], heading + Offset[3]];
    }

    private getPlay(option: WorldAnimationOption): WorldAnimationPlay | null {
        const player = this.playerService.getPlayer();
        if (!player) {
            return null;
        }

        if (player.skin.Model.Hash !== PlayerPedHash.Male && option.female) {
            return option.female;
        }

        return option.male;
    }

    private buildScenario(play: Extract<WorldAnimationPlay, { type: 'scenario' }>, seatPosition: Vector4): Scenario {
        return {
            name: play.name,
            position: seatPosition,
            isSittingScenario: play.isSittingScenario,
            shouldTeleport: play.shouldTeleport,
        };
    }

    private buildSeatAnimation(
        entity: number,
        play: Extract<WorldAnimationPlay, { type: 'seat_animation' }>,
        seatPosition: Vector4
    ): Animation {
        const seatPositionEnter = GetOffsetFromEntityInWorldCoords(entity, 0, -0.5, 1.0);

        return {
            enter: {
                ...play.enter,
                coords: [seatPositionEnter[0], seatPositionEnter[1], seatPositionEnter[2], seatPosition[3]],
            },
            base: { ...play.base, coords: seatPosition },
            exit: { ...play.exit, coords: seatPosition },
        };
    }

    public async playWorldAnimation(entity: number, play: WorldAnimationPlay, seatKey?: string) {
        const ped = PlayerPedId();
        const position = GetEntityCoords(ped) as Vector3;
        const heading = GetEntityHeading(ped);
        const seatPosition = this.calculateSeatPosition(entity, position, seatKey);

        if (play.type === 'scenario') {
            const preexistingObjects = snapshotObjects();

            await this.animationService.playScenario(this.buildScenario(play, seatPosition), { useFreeCam: true });

            // The scenario prop is dropped when the scenario is cancelled, during the exit clip.
            const seatCoords: Vector3 = [seatPosition[0], seatPosition[1], seatPosition[2]];
            for (const delay of SCENARIO_PROPS_SWEEP_DELAYS_MS) {
                setTimeout(() => sweepDroppedObjects(preexistingObjects, seatCoords), delay);
            }
        } else {
            await this.animationService.playAnimation(this.buildSeatAnimation(entity, play, seatPosition), {
                useFreeCam: true,
            });
        }

        if (play.shouldTeleport) {
            SetPedCoordsKeepVehicle(ped, position[0], position[1], position[2]);
            SetEntityHeading(ped, heading);
        }
    }

    // Plays the looping part of the animation on a ghost of the player, at the seat the player would take.
    public previewWorldAnimation(entity: number, play: WorldAnimationPlay, seatKey?: string): () => void {
        const position = GetEntityCoords(PlayerPedId()) as Vector3;
        const seatPosition = this.calculateSeatPosition(entity, position, seatKey);

        if (play.type === 'scenario' && play.preview && DoesAnimDictExist(play.preview.dictionary)) {
            const base = {
                ...play.preview,
                coords: seatPosition,
                options: { repeat: true, ignoreGravity: true, ...play.preview.options },
            };

            return this.worldAnimationPreviewService.start(ped => this.animationFactory.createAnimation({ base }, { ped }));
        }

        if (play.type === 'scenario') {
            return this.worldAnimationPreviewService.start(ped => {
                // Put straight on the seat and played in place without its enter clip: a scenario
                // started at a position always plays it, hiding the final pose for seconds.
                SetEntityCoordsNoOffset(ped, seatPosition[0], seatPosition[1], seatPosition[2], false, false, false);
                SetEntityHeading(ped, seatPosition[3]);
                // Without collision, the in-place scenario would otherwise let it fall through the prop.
                FreezeEntityPosition(ped, true);

                return this.animationFactory.createScenario({ name: play.name, playEnterAnim: false }, { ped });
            });
        }

        const { base } = this.buildSeatAnimation(entity, play, seatPosition);

        return this.worldAnimationPreviewService.start(ped => this.animationFactory.createAnimation({ base }, { ped }));
    }

    private createTarget(option: WorldAnimationOption, seatKey?: string): TargetOption {
        return {
            icon: option.icon,
            label: option.label,
            category: 'citizen',
            action: async entity => {
                const play = this.getPlay(option);
                if (!play) {
                    return;
                }

                await this.playWorldAnimation(entity, play, seatKey);
            },
            preview: entity => {
                const play = this.getPlay(option);
                if (!play) {
                    return;
                }

                return this.previewWorldAnimation(entity, play, seatKey);
            },
        };
    }

    @Once(OnceStep.PlayerLoaded)
    public async setupSitAnimation() {
        for (const group of WorldAnimationGroups) {
            const multiSeatModels = group.models.filter(model => this.getSeats(model).length > 0);
            const singleSeatModels = group.models.filter(model => !multiSeatModels.includes(model));

            // Une place (ou B-Target, qui n'a pas de sous-menus): la place la plus proche du joueur
            this.targetFactory.createForModel(
                singleSeatModels,
                group.options.map(option => this.createTarget(option)),
                group.distance
            );
            this.targetFactory.createForModel(
                multiSeatModels,
                group.options.map(option => ({ ...this.createTarget(option), mode: TargetMode.Crosshair })),
                group.distance
            );

            // Menu contextuel: un sous-menu par place, dans l'ordre des places puis des options
            for (const model of multiSeatModels) {
                const targets = this.getSeats(model).flatMap(({ key, label }, seatIndex) =>
                    group.options.map((option, optionIndex) => ({
                        ...this.createTarget(option, key),
                        mode: TargetMode.Cursor,
                        group: label,
                        order: `seat-${String(seatIndex).padStart(2, '0')}-${String(optionIndex).padStart(2, '0')}`,
                    }))
                );

                this.targetFactory.createForModel(model, targets, group.distance);
            }
        }
    }
}
