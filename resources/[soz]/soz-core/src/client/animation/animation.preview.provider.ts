import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { AnimationConfigItem, AnimationProps } from '../../shared/animation';
import { NuiEvent } from '../../shared/event';
import { Vector3 } from '../../shared/polyzone/vector';
import { ResourceLoader } from '../repository/resource.loader';

// The menu panel is styled `w-[36vh]`, so its width in screen-width units depends on the aspect
// ratio. Deriving the preview position from it keeps the ped tucked against the panel on
// ultrawide setups too, instead of drifting to the middle of the screen.
const MENU_WIDTH_IN_VH = 0.36;
const PREVIEW_GAP_FROM_MENU = 0.12;

// Vertical position of the ped's *feet*, in normalized screen coordinates (0 = top, 1 = bottom).
// Keeping this high also lifts the ghost off the ground in world space, well above road traffic.
const PREVIEW_SCREEN_FEET_Y = 0.30;

// How much of the screen height the ped should cover. The camera distance is derived from this
// rather than hardcoded, because apparent size depends on the player's FOV: pinning the distance
// instead would make the ped fill the whole screen on a narrow FOV.
const PREVIEW_SCREEN_HEIGHT = 0.45;
const PED_HEIGHT = 2.35;

// A dedicated light is drawn on the preview every frame, from the camera side. Without it the ped
// is lit by the world — pitch black at night — which is what makes it read as a bystander standing
// in the scene instead of an interface element.
const PREVIEW_LIGHT_TOWARDS_CAMERA = 0.8;
const PREVIEW_LIGHT_HEIGHT = 1.0;
const PREVIEW_LIGHT_RANGE = 3.0;
const PREVIEW_LIGHT_INTENSITY = 2.0;

// The engine quantizes entity alpha in steps of 51 (0 / 51 / 102 / 153 / 204 / 255), so 204 is
// the subtlest transparency available and 255 the only step above it.
const PREVIEW_ALPHA = 255;

// AF_LOOPING (1) to keep the preview playing, AF_TURN_OFF_COLLISION (512) so the animation itself
// never re-establishes contact with the world, and AF_IGNORE_GRAVITY (2048) because the ghost
// hangs in mid-air instead of standing on the ground.
// AF_OVERRIDE_PHYSICS is deliberately absent: it hands the ped's transform to the animation, which
// then ignores the per-frame repositioning that pins the ghost to the camera.
const PREVIEW_ANIM_FLAGS = 1 | 512 | 2048;

// Model of the invisible anchor the ghost is attached to. Any model works since it is never
// rendered; this one is a small prop already used elsewhere in the codebase.
const ANCHOR_MODEL = GetHashKey('prop_cardbordbox_03a');

const DEG_TO_RAD = Math.PI / 180;

@Provider()
export class AnimationPreviewProvider {
    @Inject(ResourceLoader)
    private resourceLoader: ResourceLoader;

    private ghost: number | null = null;

    // Invisible entity the ghost rides on. The ghost cannot be positioned directly because its
    // animation task owns its transform, and it cannot be attached to the player either, since the
    // player's own movement and turning would then leak into the preview.
    private anchor: number | null = null;

    private loadedDictionary: string | null = null;
    private props: number[] = [];

    // Bumped on every start/stop so an in-flight dictionary load from a previous, superseded
    // hover can detect it's stale and bail out instead of animating a ghost that's already gone.
    private requestId = 0;

    // The ghost lives in the world, but is re-pinned to the gameplay camera every frame so it
    // stays at a fixed spot on screen. That keeps the player's own camera and movement entirely
    // free while the preview plays, which a scripted camera takeover would not.
    @Tick(TickInterval.EVERY_FRAME)
    public pinGhostToCamera(): void {
        if (this.ghost === null || this.anchor === null || !DoesEntityExist(this.ghost)) {
            return;
        }

        const camCoords = GetGameplayCamCoord() as Vector3;
        const camRot = GetGameplayCamRot(2) as Vector3;

        const pitch = camRot[0] * DEG_TO_RAD;
        const yaw = camRot[2] * DEG_TO_RAD;

        const forward: Vector3 = [-Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
        const right: Vector3 = [Math.cos(yaw), Math.sin(yaw), 0];
        const up: Vector3 = [
            right[1] * forward[2] - right[2] * forward[1],
            right[2] * forward[0] - right[0] * forward[2],
            right[0] * forward[1] - right[1] * forward[0],
        ];

        const aspectRatio = GetAspectRatio(false);
        const halfFovTangent = Math.tan((GetGameplayCamFov() * DEG_TO_RAD) / 2);

        // Back the ped away until it covers exactly the requested fraction of the screen height.
        const distance = PED_HEIGHT / PREVIEW_SCREEN_HEIGHT / (2 * halfFovTangent);

        // Convert the target screen position into a world offset at that distance, using the
        // camera frustum, so the ped lands on the same screen spot whatever the FOV or the
        // player's aspect ratio.
        const halfHeight = distance * halfFovTangent;
        const halfWidth = halfHeight * aspectRatio;

        const screenX = MENU_WIDTH_IN_VH / aspectRatio + PREVIEW_GAP_FROM_MENU;
        const offsetRight = (screenX - 0.5) * 2 * halfWidth;
        const offsetUp = (0.5 - PREVIEW_SCREEN_FEET_Y) * 2 * halfHeight;

        const x = camCoords[0] + forward[0] * distance + right[0] * offsetRight + up[0] * offsetUp;
        const y = camCoords[1] + forward[1] * distance + right[1] * offsetRight + up[1] * offsetUp;
        const z = camCoords[2] + forward[2] * distance + right[2] * offsetRight + up[2] * offsetUp;

        // The anchor carries no animation task, so unlike the ghost it accepts being repositioned.
        // Mirroring the camera's yaw *and* pitch makes the ghost's forward vector the exact
        // opposite of the camera's, so it shows its front even seen from straight above.
        SetEntityCoordsNoOffset(this.anchor, x, y, z, true, true, true);
        SetEntityRotation(this.anchor, -camRot[0], 0.0, camRot[2] + 180, 2, false);

        // Re-attached every frame rather than once, so the binding survives anything that detaches
        // the ghost, such as clearing its tasks when switching animations. isPed must be true here,
        // as pitch is ignored otherwise.
        AttachEntityToEntity(this.ghost, this.anchor, 0, 0, 0, 0, 0, 0, 0, false, false, false, true, 2, true);

        DrawLightWithRange(
            x - forward[0] * PREVIEW_LIGHT_TOWARDS_CAMERA,
            y - forward[1] * PREVIEW_LIGHT_TOWARDS_CAMERA,
            z + PREVIEW_LIGHT_HEIGHT,
            255,
            255,
            255,
            PREVIEW_LIGHT_RANGE,
            PREVIEW_LIGHT_INTENSITY
        );
    }

    @OnNuiEvent(NuiEvent.PlayerMenuAnimationPreviewStart)
    public async startPreview({ animationItem }: { animationItem: AnimationConfigItem }): Promise<void> {
        const requestId = ++this.requestId;

        let dictionary: string | null = null;
        let animationName: string | null = null;
        let scenarioName: string | null = null;

        if (animationItem.type === 'animation') {
            dictionary = animationItem.animation.base.dictionary;
            animationName = animationItem.animation.base.name;
        } else if (animationItem.type === 'scenario') {
            scenarioName = animationItem.scenario.name;
        } else {
            // Categories, events and walk styles have no single pose to preview.
            this.stopPreview();
            return;
        }

        if (!this.ghost || !DoesEntityExist(this.ghost)) {
            await this.createGhost();
        }

        if (dictionary && dictionary !== this.loadedDictionary) {
            await this.resourceLoader.loadAnimationDictionary(dictionary);
        }

        // Bail out if a newer hover (or a stop) happened while we were awaiting the dictionary.
        if (requestId !== this.requestId || !this.ghost || !DoesEntityExist(this.ghost)) {
            return;
        }

        if (this.loadedDictionary && this.loadedDictionary !== dictionary) {
            this.resourceLoader.unloadAnimationDictionary(this.loadedDictionary);
        }

        this.loadedDictionary = dictionary;

        this.deleteProps();
        ClearPedTasksImmediately(this.ghost);

        if (dictionary && animationName) {
            // lockX/Y/Z must stay false: locking the root freezes the ghost wherever the animation
            // started and overrides the per-frame repositioning. Root motion needs no countering
            // here anyway, since every frame rewrites both position and rotation from the camera.
            TaskPlayAnim(
                this.ghost,
                dictionary,
                animationName,
                8.0,
                -8.0,
                -1,
                PREVIEW_ANIM_FLAGS,
                0.0,
                false,
                false,
                false
            );
        } else if (scenarioName) {
            TaskStartScenarioInPlace(this.ghost, scenarioName, 0, true);
        }

        if (animationItem.type === 'animation' && animationItem.animation.props) {
            await this.attachProps(animationItem.animation.props, requestId);
        }
    }

    // Mirrors how AttachedObjectService attaches animation props, but creates them locally instead
    // of as networked mission entities: these are hover previews, so they must never reach other
    // players, nor register themselves server-side on every hovered entry.
    private async attachProps(props: AnimationProps[], requestId: number): Promise<void> {
        for (const prop of props) {
            // The real animation picks at random among the variants; a preview stays deterministic
            // so that hovering the same entry twice shows the same thing.
            const model = Array.isArray(prop.model) ? prop.model[0] : prop.model;

            if (!(await this.resourceLoader.loadModel(model))) {
                continue;
            }

            if (requestId !== this.requestId || !this.ghost || !DoesEntityExist(this.ghost)) {
                this.resourceLoader.unloadModel(model);

                return;
            }

            const object = CreateObject(GetHashKey(model), 0, 0, 0, false, false, false);

            SetEntityCollision(object, false, false);
            AttachEntityToEntity(
                object,
                this.ghost,
                GetPedBoneIndex(this.ghost, prop.bone),
                prop.position[0],
                prop.position[1],
                prop.position[2],
                prop.rotation[0],
                prop.rotation[1],
                prop.rotation[2],
                true,
                true,
                false,
                true,
                0,
                true
            );

            this.props.push(object);
            this.resourceLoader.unloadModel(model);
        }
    }

    private deleteProps(): void {
        for (const prop of this.props) {
            if (DoesEntityExist(prop)) {
                DetachEntity(prop, true, true);
                DeleteEntity(prop);
            }
        }

        this.props = [];
    }

    @OnNuiEvent(NuiEvent.PlayerMenuAnimationPreviewStop)
    public async stopPreview(): Promise<void> {
        this.requestId++;

        this.deleteProps();

        if (this.loadedDictionary) {
            this.resourceLoader.unloadAnimationDictionary(this.loadedDictionary);
            this.loadedDictionary = null;
        }

        if (this.ghost !== null) {
            if (DoesEntityExist(this.ghost)) {
                DetachEntity(this.ghost, true, true);
                ClearPedTasksImmediately(this.ghost);
                DeleteEntity(this.ghost);
            }

            this.ghost = null;
        }

        if (this.anchor !== null) {
            if (DoesEntityExist(this.anchor)) {
                DeleteEntity(this.anchor);
            }

            this.anchor = null;
        }
    }

    private async createGhost(): Promise<void> {
        await this.resourceLoader.loadModel(ANCHOR_MODEL);

        const anchor = CreateObjectNoOffset(ANCHOR_MODEL, 0, 0, 0, false, false, false);

        SetEntityVisible(anchor, false, false);
        SetEntityCollision(anchor, false, false);
        FreezeEntityPosition(anchor, true);

        this.anchor = anchor;

        const ghost = ClonePed(PlayerPedId(), false, false, false);

        // Pull the ghost out of the physics world entirely rather than just muting its collision
        // responses: while it was still a physical body, teleporting it into a vehicle every frame
        // made the engine resolve the interpenetration by despawning that vehicle.
        SetEntityCompletelyDisableCollision(ghost, false, false);
        SetEntityInvincible(ghost, true);
        SetBlockingOfNonTemporaryEvents(ghost, true);
        SetEntityAlpha(ghost, PREVIEW_ALPHA, false);

        // Deliberately not frozen: FreezeEntityPosition pins the entity to a cached matrix, and
        // starting a new animation task re-seeds the ped from it, after which the per-frame
        // repositioning no longer takes effect while rotation still does. Nothing here needs the
        // freeze anyway — collision is off, the animations carry AF_IGNORE_GRAVITY, and every
        // frame rewrites the position from the camera.

        // The contact shadow under the feet is a strong cue that the ped is standing on the
        // ground, which fights the "floating interface element" read.
        SetPedAoBlobRendering(ghost, false);

        this.ghost = ghost;
        this.pinGhostToCamera();
    }
}
