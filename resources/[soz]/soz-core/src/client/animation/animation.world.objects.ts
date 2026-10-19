import { getDistance, Vector3 } from '@public/shared/polyzone/vector';

// Scenario props (cup, bottle, plate, ...) are spawned by the game, not by us, so there is no handle
// to delete once the ped drops them. These helpers find them back as the objects that appeared
// around a spot after a snapshot.

const SWEEP_RADIUS = 3.0;

export const snapshotObjects = (): Set<number> => new Set(GetGamePool('CObject') as number[]);

export const deleteObject = (object: number): void => {
    if (!DoesEntityExist(object)) {
        return;
    }

    // Objects spawned by the game are not owned by this script, DeleteEntity ignores them otherwise.
    SetEntityAsMissionEntity(object, true, true);
    DetachEntity(object, true, true);
    DeleteEntity(object);
};

// Attached objects are never swept, they are still held by someone (possibly a new scenario started
// at the same spot, reusing a deleted handle). Networked objects are only swept when owned by us.
export const sweepDroppedObjects = (
    preexisting: Set<number>,
    position: Vector3,
    extra: Set<number> = new Set()
): void => {
    for (const object of GetGamePool('CObject') as number[]) {
        if (IsEntityAttached(object)) {
            continue;
        }

        const ours = !NetworkGetEntityIsNetworked(object) || NetworkGetEntityOwner(object) === PlayerId();
        const spawnedNearby =
            !preexisting.has(object) &&
            ours &&
            getDistance(GetEntityCoords(object) as Vector3, position) <= SWEEP_RADIUS;

        if (extra.has(object) || spawnedNearby) {
            deleteObject(object);
        }
    }
};
