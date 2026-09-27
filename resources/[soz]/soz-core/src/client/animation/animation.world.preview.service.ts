import { Injectable } from '@core/decorators/injectable';
import { Vector3 } from '@public/shared/polyzone/vector';

import { AnimationRunner } from './animation.factory';
import { deleteObject, snapshotObjects, sweepDroppedObjects } from './animation.world.objects';

// The engine quantizes entity alpha in steps of 51, 204 is the step right under fully opaque.
const PREVIEW_ALPHA = 204;

// Scenario props (bottle, plate, ...) are spawned by the game on the clone, not by us, so they are
// found through the object pool to be faded with the clone and deleted with it.
const REFRESH_MS = 100;

// The game drops the scenario props when the clone goes away, sometimes a few frames later.
const LATE_SWEEP_DELAY_MS = 500;

@Injectable()
export class WorldAnimationPreviewService {
    private stopCurrent: (() => void) | null = null;

    // Spawns a local, semi transparent clone of the player and makes it play the runner built by
    // `play`. Only one preview lives at a time; the returned function removes it.
    public start(play: (ped: number) => AnimationRunner): () => void {
        this.stop();

        const preexistingObjects = snapshotObjects();
        const trackedObjects = new Set<number>();

        const clone = ClonePed(PlayerPedId(), false, false, false);

        // No collision nor physics: the clone must never push the player or fall through the prop,
        // the scenario / animation itself puts it in place.
        SetEntityCollision(clone, false, false);
        SetEntityInvincible(clone, true);
        SetBlockingOfNonTemporaryEvents(clone, true);
        SetEntityAlpha(clone, PREVIEW_ALPHA, false);

        const runner = play(clone);

        const interval = setInterval(() => {
            for (const object of this.getAttachedObjects(clone)) {
                trackedObjects.add(object);
                SetEntityAlpha(object, PREVIEW_ALPHA, false);
            }
        }, REFRESH_MS);

        const stop = () => {
            clearInterval(interval);
            runner.cancel();

            const position = GetEntityCoords(clone) as Vector3;

            for (const object of this.getAttachedObjects(clone)) {
                deleteObject(object);
            }

            sweepDroppedObjects(preexistingObjects, position, trackedObjects);

            if (DoesEntityExist(clone)) {
                DeleteEntity(clone);
            }

            setTimeout(() => sweepDroppedObjects(preexistingObjects, position, trackedObjects), LATE_SWEEP_DELAY_MS);

            if (this.stopCurrent === stop) {
                this.stopCurrent = null;
            }
        };

        this.stopCurrent = stop;

        return stop;
    }

    public stop(): void {
        if (this.stopCurrent) {
            this.stopCurrent();
        }
    }

    private getAttachedObjects(ped: number): number[] {
        if (!DoesEntityExist(ped)) {
            return [];
        }

        return (GetGamePool('CObject') as number[]).filter(object => GetEntityAttachedTo(object) === ped);
    }
}
