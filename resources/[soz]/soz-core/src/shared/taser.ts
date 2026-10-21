import { TaserConfig } from '../config/taser';

export type DazeState = {
    firstHitAt: number;
    startedAt: number;
    endsAt: number;
};

export const rollDazeDuration = (random: number): number => {
    const { minDurationMs, maxDurationMs } = TaserConfig.daze;

    return Math.round(minDurationMs + random * (maxDurationMs - minDurationMs));
};

export const startDaze = (now: number, random: number): DazeState => {
    return {
        firstHitAt: now,
        startedAt: now,
        endsAt: now + rollDazeDuration(random),
    };
};

export const extendDaze = (state: DazeState, now: number, random: number): DazeState => {
    const remaining = getDazeRemaining(state, now);
    const hardEnd = state.firstHitAt + TaserConfig.daze.maxCumulatedDurationMs;

    return {
        firstHitAt: state.firstHitAt,
        startedAt: now,
        endsAt: Math.min(now + remaining + rollDazeDuration(random), hardEnd),
    };
};

export const anchorDaze = (now: number, duration: number): DazeState => {
    return {
        firstHitAt: now,
        startedAt: now,
        endsAt: now + duration,
    };
};

export const getDazeDuration = (state: DazeState): number => {
    return state.endsAt - state.startedAt;
};

export const getDazeRemaining = (state: DazeState, now: number): number => {
    return Math.max(state.endsAt - now, 0);
};

export const getDazeIntensity = (state: DazeState, now: number): number => {
    const duration = getDazeDuration(state);

    if (duration <= 0) {
        return 0;
    }

    const elapsed = now - state.startedAt;

    if (elapsed <= 0) {
        return 1;
    }

    const fullIntensityUntil = duration * TaserConfig.daze.fullIntensityRatio;

    if (elapsed <= fullIntensityUntil) {
        return 1;
    }

    if (elapsed >= duration) {
        return 0;
    }

    return (duration - elapsed) / (duration - fullIntensityUntil);
};

export const getStumbleDelay = (intensity: number, random: number): number | null => {
    const { minIntervalMs, maxIntervalMs, jitterRatio, minIntensity } = TaserConfig.stumble;

    if (intensity < minIntensity) {
        return null;
    }

    const interval = minIntervalMs + (1 - Math.min(intensity, 1)) * (maxIntervalMs - minIntervalMs);

    return Math.round(interval * (1 + jitterRatio * (2 * random - 1)));
};
