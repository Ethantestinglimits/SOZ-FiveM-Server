import { Vector3 } from '../../shared/polyzone/vector';

export function getVehicleSpeedKmh(entity: number): number {
    return GetEntitySpeed(entity) * 3.6;
}

export function ragdollWithVelocity(ped: number, velocity: Vector3, durationMs = 5511): void {
    SetPedToRagdoll(ped, durationMs, durationMs, 0, false, false, false);
    SetEntityVelocity(ped, velocity[0], velocity[1], velocity[2]);
}
