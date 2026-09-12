import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { wait } from '../../core/utils';
import { NuiEvent } from '../../shared/event';
import { joaat } from '../../shared/joaat';
import { getDistance, Vector3, Vector4 } from '../../shared/polyzone/vector';
import { Notifier } from '../notifier';
import { NuiDispatch } from '../nui/nui.dispatch';
import { ObjectEditorProvider } from '../object/object.editor.provider';
import { ResourceLoader } from '../repository/resource.loader';
import { AnimationService } from './animation.service';

const MARKER_MODEL = joaat('p_bloodsplat_s');
const SPINE_BONE_NAME = 'SKEL_Spine1';

@Provider()
export class AnimationCalibrateProvider {
    @Inject(ObjectEditorProvider)
    private objectEditorProvider: ObjectEditorProvider;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(ResourceLoader)
    private resourceLoader: ResourceLoader;

    @Inject(Notifier)
    private notifier: Notifier;

    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private moving = false;
    private lastAnimationRunning = false;

    @Tick(TickInterval.EVERY_SECOND)
    public syncAnimationRunningState(): void {
        const running = this.animationService.hasRunningAnimation();

        if (running === this.lastAnimationRunning) {
            return;
        }

        this.lastAnimationRunning = running;
        this.nuiDispatch.dispatch('player', 'UpdateAnimationRunning', running);
    }

    @OnNuiEvent(NuiEvent.PlayerMenuAnimationMoveOffset)
    public async moveAnimation(): Promise<void> {
        if (this.moving) {
            return;
        }

        const runningAnimation = this.animationService.getRunningAnimation();

        if (!runningAnimation) {
            this.notifier.error('Vous devez être en train de jouer une animation pour utiliser cet outil.');

            return;
        }

        this.moving = true;

        const ped = PlayerPedId();
        let ghost: number | null = null;
        let frozen = false;

        try {
            // Starting a scenario/animation (e.g. sitting) can make the game engine snap the ped into
            // its final spot a moment after the task starts. Wait for that to settle before we capture
            // the position, otherwise the gizmo opens where the ped *was*, not where it ended up.
            await this.waitForPedToStabilize(ped);

            const pedStartCoords = GetEntityCoords(ped) as Vector3;
            const heading = GetEntityHeading(ped);

            // GetEntityCoords is the ped's logical entity origin, which for some animations (climbing,
            // hanging, vaulting...) can be far from where the body is actually rendered. Anchor the
            // gizmo on the spine bone instead, which always matches the current visual pose, and track
            // the user's edits as a delta applied on top of the real entity coords.
            const spineBone = GetEntityBoneIndexByName(ped, SPINE_BONE_NAME);
            const spineStart = (spineBone !== -1 ? GetEntityBonePosition_2(ped, spineBone) : pedStartCoords) as Vector3;

            const markerStartPosition = [spineStart[0], spineStart[1], spineStart[2], heading] as Vector4;

            // Freeze the real ped for the whole editing session: only the ghost moves on screen, but
            // without this the ped (e.g. sitting on the edge of a roof) can still slide off and fall
            // while the player is busy dragging the gizmo.
            FreezeEntityPosition(ped, true);
            frozen = true;

            ghost = await this.createGhost(ped, [...pedStartCoords, heading] as Vector4, runningAnimation);

            const result = await this.objectEditorProvider.createOrUpdateObject(MARKER_MODEL, {
                allowRotation: true,
                allowScale: false,
                allowDelete: false,
                allowDuplicate: false,
                allowToggleCollision: false,
                allowToggleSnap: false,
                allowTogglePermanent: false,
                allowAddEffect: false,
                allowSetName: false,
                onlyZRotation: false,
                collision: false,
                useCircularCamera: true,
                invisible: true,
                highlight: false,
                maxDistance: 3.0,
                initialPosition: markerStartPosition,
                onDrawCallback: object => {
                    const [x, y, z] = this.applyDelta(pedStartCoords, spineStart, object.position);

                    SetEntityCoordsNoOffset(ghost, x, y, z, true, true, true);
                    SetEntityHeading(ghost, object.position[3]);
                },
            });

            ClearPedTasksImmediately(ghost);
            DeleteEntity(ghost);
            ghost = null;

            if (!result) {
                // Cancelled: go back exactly where the animation was launched, so the ped never ends
                // up stuck somewhere risky (e.g. the edge of a roof) because of a stray nudge.
                SetEntityCoordsNoOffset(ped, pedStartCoords[0], pedStartCoords[1], pedStartCoords[2], true, true, true);
                SetEntityHeading(ped, heading);
                FreezeEntityPosition(ped, false);
                frozen = false;
                this.guardAgainstFall(ped, pedStartCoords, heading);

                return;
            }

            const [x, y, z] = this.applyDelta(pedStartCoords, spineStart, result.position);

            // Only reposition the real ped, never touch its task: it's still the same tracked
            // AnimationService runner playing on it, and clearing/restarting that task ourselves
            // would make the service think the animation was interrupted and stop it right back out
            // from under us. A plain coordinate move doesn't affect a running TaskPlayAnim/scenario.
            SetEntityCoordsNoOffset(ped, x, y, z, true, true, true);
            SetEntityHeading(ped, result.position[3]);

            // The animation's pose (e.g. sitting) has no collision of its own at the new spot, so the
            // ped would otherwise fall/clip through whatever it's supposed to be resting on. Stay
            // frozen (already the case since the tool opened) until the animation itself ends, then
            // hand off ownership of the freeze to that callback.
            frozen = false;
            runningAnimation.runner.finally(() => {
                FreezeEntityPosition(ped, false);
                this.guardAgainstFall(ped, pedStartCoords, heading);
            });
        } finally {
            this.moving = false;

            if (ghost !== null && DoesEntityExist(ghost)) {
                ClearPedTasksImmediately(ghost);
                DeleteEntity(ghost);
            }

            if (frozen) {
                FreezeEntityPosition(ped, false);
            }
        }
    }

    // Safety net: if the new spot turns out to have nothing solid under it (e.g. a bad calibration
    // dropping the ped over a ledge), catch the ped mid-fall and put it back on solid ground at the
    // last known-safe spot (where the animation was originally launched) instead of letting it fall
    // into the void.
    private async guardAgainstFall(ped: number, safeCoords: Vector3, safeHeading: number): Promise<void> {
        const deadline = Date.now() + 5000;

        while (Date.now() < deadline) {
            await wait(200);

            if (!DoesEntityExist(ped) || (!IsPedFalling(ped) && !IsPedRagdoll(ped))) {
                continue;
            }

            const [foundGround, groundZ] = GetGroundZFor_3dCoord(
                safeCoords[0],
                safeCoords[1],
                safeCoords[2] + 2.0,
                false
            ) as [boolean, number];

            SetEntityCoordsNoOffset(
                ped,
                safeCoords[0],
                safeCoords[1],
                foundGround ? groundZ + 0.05 : safeCoords[2],
                true,
                true,
                true
            );
            SetEntityHeading(ped, safeHeading);
            SetEntityVelocity(ped, 0.0, 0.0, 0.0);

            return;
        }
    }

    private async playRunningAnimation(
        entity: number,
        runningAnimation: { dictionary?: string; name: string }
    ): Promise<void> {
        if (runningAnimation.dictionary) {
            await this.resourceLoader.loadAnimationDictionary(runningAnimation.dictionary);
            TaskPlayAnim(
                entity,
                runningAnimation.dictionary,
                runningAnimation.name,
                8.0,
                -8.0,
                -1,
                1,
                0,
                false,
                false,
                false
            );
        } else {
            TaskStartScenarioInPlace(entity, runningAnimation.name, 0, true);
        }
    }

    // Translates a gizmo-space position (anchored on the spine bone) back into a world position
    // for the real ped entity origin, by re-applying the same delta the user dragged the gizmo by.
    private applyDelta(pedCoords: Vector3, gizmoOrigin: Vector3, gizmoPosition: Vector4 | Vector3): Vector3 {
        return [
            pedCoords[0] + (gizmoPosition[0] - gizmoOrigin[0]),
            pedCoords[1] + (gizmoPosition[1] - gizmoOrigin[1]),
            pedCoords[2] + (gizmoPosition[2] - gizmoOrigin[2]),
        ];
    }

    private async waitForPedToStabilize(ped: number): Promise<void> {
        const deadline = Date.now() + 2000;
        let lastCoords = GetEntityCoords(ped) as Vector3;

        while (Date.now() < deadline) {
            await wait(150);

            const coords = GetEntityCoords(ped) as Vector3;

            if (getDistance(coords, lastCoords) < 0.01) {
                return;
            }

            lastCoords = coords;
        }
    }

    private async createGhost(
        ped: number,
        position: Vector4,
        runningAnimation: { dictionary?: string; name: string }
    ): Promise<number> {
        const ghost = ClonePed(ped, false, false, false);

        SetEntityCoordsNoOffset(ghost, position[0], position[1], position[2], true, true, true);
        SetEntityHeading(ghost, position[3]);
        SetEntityAlpha(ghost, 150, false);
        SetEntityCollision(ghost, false, false);
        SetEntityInvincible(ghost, true);
        FreezeEntityPosition(ghost, false);

        await this.playRunningAnimation(ghost, runningAnimation);

        return ghost;
    }
}
