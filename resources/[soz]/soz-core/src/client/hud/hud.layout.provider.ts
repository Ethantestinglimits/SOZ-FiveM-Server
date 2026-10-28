import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import {
    DEFAULT_MINIMAP_STYLE,
    HUD_ELEMENTS,
    HUD_SCALE_MAX,
    HUD_SCALE_MIN,
    HudLayout,
    MINIMAP_BORDER_MAX,
    MINIMAP_FRAME_MODES,
    MINIMAP_OPACITY_MIN,
    MINIMAP_RADIUS_MAX,
    MINIMAP_SHAPES,
    MinimapStyle,
} from '../../shared/nui/hud_layout';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMenuProvider } from '../pause/pause.menu.provider';
import { HudWatchProvider } from './hud.watch.provider';

const LAYOUT_KVP = 'soz_hud_layout';

const clampPercent = (value: unknown): number | null => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number * 10) / 10)) : null;
};

const clampScale = (value: unknown): number | null => {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return null;
    }

    const scale = Math.round(Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, number)) * 100) / 100;

    return Math.abs(scale - 1) < 0.005 ? null : scale;
};

const clampRange = (value: unknown, min: number, max: number, fallback: number): number => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number))) : fallback;
};

const sanitizeMinimapStyle = (input: Partial<MinimapStyle> | null | undefined): MinimapStyle | null => {
    if (!input) {
        return null;
    }

    const style: MinimapStyle = {
        shape: MINIMAP_SHAPES.includes(input.shape) ? input.shape : DEFAULT_MINIMAP_STYLE.shape,
        opacity: clampRange(input.opacity, MINIMAP_OPACITY_MIN, 100, DEFAULT_MINIMAP_STYLE.opacity),
        borderWidth: clampRange(input.borderWidth, 0, MINIMAP_BORDER_MAX, DEFAULT_MINIMAP_STYLE.borderWidth),
        borderColor: /^#[0-9a-fA-F]{6}$/.test(String(input.borderColor))
            ? String(input.borderColor)
            : DEFAULT_MINIMAP_STYLE.borderColor,
        frame: MINIMAP_FRAME_MODES.includes(input.frame) ? input.frame : DEFAULT_MINIMAP_STYLE.frame,
    };

    if (input.radius !== undefined && input.radius !== null) {
        style.radius = clampRange(input.radius, 0, MINIMAP_RADIUS_MAX, 0);
    }

    return JSON.stringify(style) === JSON.stringify(DEFAULT_MINIMAP_STYLE) ? null : style;
};

const sanitize = (input: HudLayout | null | undefined): HudLayout => {
    const layout: HudLayout = {};

    for (const { id } of HUD_ELEMENTS) {
        const x = clampPercent(input?.[id]?.x);
        const y = clampPercent(input?.[id]?.y);

        if (x !== null && y !== null) {
            const scale = clampScale(input?.[id]?.scale);

            layout[id] = scale === null ? { x, y } : { x, y, scale };
        }
    }

    const minimapStyle = sanitizeMinimapStyle(input?.minimapStyle);

    if (minimapStyle) {
        layout.minimapStyle = minimapStyle;
    }

    return layout;
};

@Provider()
export class HudLayoutProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PauseMenuProvider)
    private pauseMenuProvider: PauseMenuProvider;

    @Inject(HudWatchProvider)
    private hudWatchProvider: HudWatchProvider;

    private layout: HudLayout = this.load();

    @Once(OnceStep.NuiLoaded)
    public sendLayout(): void {
        this.nuiDispatch.dispatch('hud_layout', 'SetLayout', this.layout);
    }

    @OnNuiEvent(NuiEvent.HudLayoutRequest)
    public async onRequest(): Promise<void> {
        this.sendLayout();
    }

    @OnNuiEvent(NuiEvent.HudEditorOpen)
    public async onOpenEditor(): Promise<void> {
        if (!this.hudWatchProvider.haveWatch) {
            return;
        }

        this.pauseMenuProvider.close();
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
