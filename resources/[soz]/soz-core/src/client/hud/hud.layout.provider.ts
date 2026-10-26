import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import { HUD_ELEMENTS, HudLayout } from '../../shared/nui/hud_layout';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMenuProvider } from '../pause/pause.menu.provider';

const LAYOUT_KVP = 'soz_hud_layout';

const clampPercent = (value: unknown): number | null => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number * 10) / 10)) : null;
};

const sanitize = (input: HudLayout | null | undefined): HudLayout => {
    const layout: HudLayout = {};

    for (const { id } of HUD_ELEMENTS) {
        const x = clampPercent(input?.[id]?.x);
        const y = clampPercent(input?.[id]?.y);

        if (x !== null && y !== null) {
            layout[id] = { x, y };
        }
    }

    return layout;
};

@Provider()
export class HudLayoutProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PauseMenuProvider)
    private pauseMenuProvider: PauseMenuProvider;

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
