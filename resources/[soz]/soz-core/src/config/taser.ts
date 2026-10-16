export const TaserConfig = {
    daze: {
        minDurationMs: 15000,
        maxDurationMs: 30000,
        maxCumulatedDurationMs: 45000,
        fullIntensityRatio: 1 / 3,
        walkStyle: 'move_m@drunk@moderatedrunk',
    },
    cameraSway: {
        maxAmplitude: 1.5,
    },
    visual: {
        timecycle: 'Drunk',
        maxTimecycleStrength: 1.6,
        timecycleFadeExponent: 2,
        maxVignetteOpacity: 0.9,
        tintCycleMs: 7000,
        initialBlurMs: 10000,
        initialBlurFadeInMs: 300,
        initialBlurFadeOutMs: 3000,
    },
    stumble: {
        ragdollDurationMs: 1000,
        minIntervalMs: 4000,
        maxIntervalMs: 12000,
        jitterRatio: 0.3,
        minIntensity: 0.15,
    },
};
