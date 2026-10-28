import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import {
    DEFAULT_MINIMAP_STYLE,
    MINIMAP_BORDER_MAX,
    MINIMAP_FRAME_MODES,
    MINIMAP_OPACITY_MIN,
    MINIMAP_RADIUS_MAX,
    MINIMAP_SHAPES,
    MinimapStyle,
} from '../../shared/nui/minimap';
import { NuiDispatch } from '../nui/nui.dispatch';

const STYLE_KVP = 'soz_minimap_style';

const clampRange = (value: unknown, min: number, max: number, fallback: number): number => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number))) : fallback;
};

const sanitize = (input: Partial<MinimapStyle> | null | undefined): MinimapStyle => {
    if (!input) {
        return DEFAULT_MINIMAP_STYLE;
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

    return style;
};

const parse = (raw: string | null): unknown => {
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

@Provider()
export class PauseMinimapStyleProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private style: MinimapStyle = this.load();

    @Once(OnceStep.NuiLoaded)
    public sendStyle(): void {
        this.nuiDispatch.dispatch('minimap', 'Style', this.style);
    }

    public getStyle(): MinimapStyle {
        return this.style;
    }

    @OnNuiEvent(NuiEvent.MinimapStyleSet)
    public async onSet(style: MinimapStyle): Promise<void> {
        this.style = sanitize(style);

        if (JSON.stringify(this.style) === JSON.stringify(DEFAULT_MINIMAP_STYLE)) {
            DeleteResourceKvp(STYLE_KVP);
        } else {
            SetResourceKvp(STYLE_KVP, JSON.stringify(this.style));
        }

        this.sendStyle();
    }

    public reset(): void {
        this.style = DEFAULT_MINIMAP_STYLE;
        DeleteResourceKvp(STYLE_KVP);
        this.sendStyle();
    }

    private load(): MinimapStyle {
        return sanitize(parse(GetResourceKvpString(STYLE_KVP)) as Partial<MinimapStyle> | null);
    }
}
