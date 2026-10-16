export const TaserConfig = {
    daze: {
        minDurationMs: 15000,
        maxDurationMs: 30000,
        maxCumulatedDurationMs: 45000,
        fullIntensityRatio: 1 / 3,
        walkStyle: 'move_m@drunk@moderatedrunk',
    },
    cameraSway: {
        shake: 'HAND_SHAKE',
        maxAmplitude: 1.5,
    },
    stumble: {
        ragdollDurationMs: 1000,
        minIntervalMs: 4000,
        maxIntervalMs: 12000,
        jitterRatio: 0.3,
        minIntensity: 0.15,
    },
};
