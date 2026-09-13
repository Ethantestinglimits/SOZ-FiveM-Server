import { toVectorNorm, Vector3 } from '../polyzone/vector';

const GRAVITY = 9.81;

// How hard the vehicle decelerated/accelerated between two velocity samples, in G.
export function computeGStrength(lastVelocity: Vector3, velocity: Vector3, tickIntervalSeconds: number): number {
    const acceleration: Vector3 = [
        (lastVelocity[0] - velocity[0]) / tickIntervalSeconds,
        (lastVelocity[1] - velocity[1]) / tickIntervalSeconds,
        (lastVelocity[2] - velocity[2]) / tickIntervalSeconds,
    ];

    return toVectorNorm(acceleration) / GRAVITY;
}

export function computeCrashDamage(gStrength: number, threshold: number, velocity: Vector3, factor: number): number {
    return ((gStrength - threshold) * toVectorNorm(velocity)) / factor;
}
