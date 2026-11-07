import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import { CrosshairConfig, CrosshairLines, DEFAULT_CROSSHAIR } from '../../shared/nui/crosshair';
import { NuiDispatch } from '../nui/nui.dispatch';

const CROSSHAIR_KVP = 'soz_crosshair';

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

const sanitizeLines = (lines: Partial<CrosshairLines> | undefined, fallback: CrosshairLines): CrosshairLines => ({
    enabled: Boolean(lines?.enabled ?? fallback.enabled),
    opacity: clamp(lines?.opacity, 0, 100, fallback.opacity),
    length: clamp(lines?.length, 1, 30, fallback.length),
    thickness: clamp(lines?.thickness, 1, 8, fallback.thickness),
    gap: clamp(lines?.gap, 0, 40, fallback.gap),
});

const sanitize = (input: Partial<CrosshairConfig> | null | undefined): CrosshairConfig => ({
    customized: Boolean(input?.customized),
    color: typeof input?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : DEFAULT_CROSSHAIR.color,
    outline: {
        enabled: Boolean(input?.outline?.enabled ?? DEFAULT_CROSSHAIR.outline.enabled),
        opacity: clamp(input?.outline?.opacity, 0, 100, DEFAULT_CROSSHAIR.outline.opacity),
        thickness: clamp(input?.outline?.thickness, 1, 4, DEFAULT_CROSSHAIR.outline.thickness),
    },
    dot: Boolean(input?.dot),
    inner: sanitizeLines(input?.inner, DEFAULT_CROSSHAIR.inner),
    outer: sanitizeLines(input?.outer, DEFAULT_CROSSHAIR.outer),
    ring: {
        enabled: Boolean(input?.ring?.enabled),
        radius: clamp(input?.ring?.radius, 4, 40, DEFAULT_CROSSHAIR.ring.radius),
        thickness: clamp(input?.ring?.thickness, 1, 8, DEFAULT_CROSSHAIR.ring.thickness),
    },
    tStyle: Boolean(input?.tStyle),
});

@Provider()
export class HudCrosshairProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private config: CrosshairConfig = this.load();
    private visible = false;

    public getConfig(): CrosshairConfig {
        return this.config;
    }

    public isCustomized(): boolean {
        return this.config.customized;
    }

    public setVisible(visible: boolean): void {
        if (visible === this.visible) {
            return;
        }

        this.visible = visible;
        this.nuiDispatch.dispatch('crosshair', 'Visible', visible);
    }

    @Once(OnceStep.NuiLoaded)
    public sendConfig(): void {
        this.nuiDispatch.dispatch('crosshair', 'Config', this.config);
    }

    @OnNuiEvent(NuiEvent.CrosshairSet)
    public async onSet(config: CrosshairConfig): Promise<void> {
        this.config = { ...sanitize(config), customized: true };
        SetResourceKvp(CROSSHAIR_KVP, JSON.stringify(this.config));
        this.sendConfig();
    }

    @OnNuiEvent(NuiEvent.CrosshairReset)
    public async onReset(): Promise<void> {
        this.reset();
    }

    public reset(): void {
        this.config = { ...DEFAULT_CROSSHAIR };
        DeleteResourceKvp(CROSSHAIR_KVP);
        this.sendConfig();
    }

    private load(): CrosshairConfig {
        const saved = GetResourceKvpString(CROSSHAIR_KVP);

        if (!saved) {
            return { ...DEFAULT_CROSSHAIR };
        }

        try {
            return sanitize(JSON.parse(saved));
        } catch {
            return { ...DEFAULT_CROSSHAIR };
        }
    }
}
