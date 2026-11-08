import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import {
    HUD_ANCHOR_TARGETS,
    HUD_CORNERS,
    HUD_ELEMENTS,
    HUD_SCALE_MAX,
    HUD_SCALE_MIN,
    HudLayout,
    HudPlacement,
} from '../../shared/nui/hud_layout';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseSettingsRegistry } from '../pause/pause.settings.registry';

const LAYOUT_KVP = 'soz_hud_layout_v2';
const COMPASS_LEFT_KVP = 'soz_hud_compass_left';
const STREET_ON_TOP_KVP = 'soz_hud_street_on_top';
const OFFSET_LIMIT = 200;

const clampOffset = (value: unknown): number | null => {
    const number = Number(value);

    return Number.isFinite(number)
        ? Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, Math.round(number * 100) / 100))
        : null;
};

const clampScale = (value: unknown): number | undefined => {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return undefined;
    }

    const scale = Math.round(Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, number)) * 100) / 100;

    return Math.abs(scale - 1) < 0.005 ? undefined : scale;
};

const sanitizePlacement = (input: Partial<HudPlacement> | undefined, id: string): HudPlacement | null => {
    if (!input || !HUD_ANCHOR_TARGETS.includes(input.target) || input.target === id) {
        return null;
    }

    if (!HUD_CORNERS.includes(input.targetCorner) || !HUD_CORNERS.includes(input.corner)) {
        return null;
    }

    const x = clampOffset(input.x);
    const y = clampOffset(input.y);

    if (x === null || y === null) {
        return null;
    }

    const placement: HudPlacement = {
        target: input.target,
        targetCorner: input.targetCorner,
        corner: input.corner,
        x,
        y,
    };
    const scale = clampScale(input.scale);

    if (scale !== undefined) {
        placement.scale = scale;
    }

    if (input.hidden === true) {
        placement.hidden = true;
    }

    return placement;
};

const sanitize = (input: HudLayout | null | undefined): HudLayout => {
    const layout: HudLayout = {};

    for (const { id, welded } of HUD_ELEMENTS) {
        const placement = welded ? null : sanitizePlacement(input?.[id], id);

        if (placement) {
            layout[id] = placement;
        }
    }

    return layout;
};

@Provider()
export class HudLayoutProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PauseSettingsRegistry)
    private pauseSettingsRegistry: PauseSettingsRegistry;

    private layout: HudLayout = this.load();

    private compassLeft = GetResourceKvpInt(COMPASS_LEFT_KVP) === 1;

    private streetOnTop = GetResourceKvpInt(STREET_ON_TOP_KVP) === 1;

    @Once(OnceStep.Start)
    public registerSettings(): void {
        this.pauseSettingsRegistry.register('hudCompassLeft', {
            get: () => this.compassLeft,
            apply: value => {
                this.compassLeft = Boolean(value);
                SetResourceKvpInt(COMPASS_LEFT_KVP, this.compassLeft ? 1 : 0);
                this.sendWatchLayout();
            },
        });
        this.pauseSettingsRegistry.register('hudStreetOnTop', {
            get: () => this.streetOnTop,
            apply: value => {
                this.streetOnTop = Boolean(value);
                SetResourceKvpInt(STREET_ON_TOP_KVP, this.streetOnTop ? 1 : 0);
                this.sendWatchLayout();
            },
        });
    }

    @Once(OnceStep.NuiLoaded)
    public sendLayout(): void {
        this.nuiDispatch.dispatch('hud_layout', 'SetLayout', this.layout);
        this.sendWatchLayout();
    }

    private sendWatchLayout(): void {
        this.nuiDispatch.dispatch('hud', 'SetWatchLayout', {
            compassLeft: this.compassLeft,
            streetOnTop: this.streetOnTop,
        });
    }

    @OnNuiEvent(NuiEvent.HudLayoutRequest)
    public async onRequest(): Promise<void> {
        this.sendLayout();
    }

    @OnNuiEvent(NuiEvent.HudEditorOpen)
    public async onOpenEditor(): Promise<void> {
        this.nuiDispatch.dispatch('hud_layout', 'OpenEditor', this.layout);
    }

    @OnNuiEvent(NuiEvent.HudLayoutSave)
    public async onSave(layout: HudLayout): Promise<void> {
        this.layout = sanitize(layout);
        SetResourceKvp(LAYOUT_KVP, JSON.stringify(this.layout));
        this.sendLayout();
    }

    @OnNuiEvent(NuiEvent.HudLayoutReset)
    public async onReset(): Promise<void> {
        this.layout = {};
        DeleteResourceKvp(LAYOUT_KVP);
        this.sendLayout();
    }

    private load(): HudLayout {
        const saved = GetResourceKvpString(LAYOUT_KVP);

        if (!saved) {
            return {};
        }

        try {
            return sanitize(JSON.parse(saved));
        } catch {
            return {};
        }
    }
}
