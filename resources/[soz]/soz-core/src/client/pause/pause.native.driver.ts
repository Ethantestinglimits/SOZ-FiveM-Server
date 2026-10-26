import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { wait, waitUntil } from '../../core/utils';
import { Control } from '../../shared/input';
import {
    isNativeSlider,
    NATIVE_LANDING_PAGE,
    NATIVE_SETTINGS_PAGE,
    NATIVE_SLIDERS,
    NativeSliderRoute,
} from '../../shared/nui/native_settings';
import { NuiDispatch } from '../nui/nui.dispatch';

const SETTINGS_MENU = GetHashKey('FE_MENU_VERSION_LANDING_MENU');
const HOLD_FRAMES = 3;
const STEP_DELAY = 120;
const PAGE_TIMEOUT = 4000;
const MAX_LIST_PRESSES = 60;
const MAX_CLOSE_PRESSES = 8;

@Provider()
export class PauseNativeSettingsDriver {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private busy = false;
    private pendingControl: { control: number; frames: number } | null = null;

    public isBusy(): boolean {
        return this.busy;
    }

    public getSliderValue(key: string): number {
        return GetConvarInt(key, -1);
    }

    @Tick(TickInterval.EVERY_FRAME)
    public injectControl(): void {
        if (!this.pendingControl) {
            return;
        }

        SetControlNormal(2, this.pendingControl.control, 1.0);
        this.pendingControl.frames--;

        if (this.pendingControl.frames <= 0) {
            this.pendingControl = null;
        }
    }

    public async setSlider(key: string, target: number): Promise<boolean> {
        if (this.busy || !isNativeSlider(key)) {
            return false;
        }

        const route = NATIVE_SLIDERS[key];
        const value = Math.min(route.max, Math.max(route.min, Math.round(target)));

        this.busy = true;
        this.nuiDispatch.dispatch('pause_menu', 'NativeBusy', true);

        let success = false;

        try {
            success = await this.applySlider(route, value);
        } catch (error) {
            console.error(`[pause.native] ${String(error)}`);
        } finally {
            await this.closeAll();
            this.busy = false;
            this.nuiDispatch.dispatch('pause_menu', 'NativeBusy', false);
        }

        return success;
    }

    private async applySlider(route: NativeSliderRoute, value: number): Promise<boolean> {
        if (!(await this.openLanding())) {
            return false;
        }

        if (!(await this.enterCategory(route.category))) {
            return false;
        }

        if (!(await this.goToRow(route.row))) {
            return false;
        }

        for (let index = 0; index < route.max - route.min + 1; index++) {
            await this.press(Control.FrontendLeft);
        }

        for (let index = 0; index < value - route.min; index++) {
            await this.press(Control.FrontendRight);
        }

        await this.press(Control.FrontendCancel);

        return true;
    }

    private async press(control: Control): Promise<void> {
        this.pendingControl = { control, frames: HOLD_FRAMES };

        await wait(STEP_DELAY);
    }

    private getPage(): number {
        return GetPauseMenuSelectionData()[0];
    }

    private getRow(): number {
        return GetPauseMenuSelectionData()[2];
    }

    private async openLanding(): Promise<boolean> {
        if (!IsPauseMenuActive()) {
            ActivateFrontendMenu(SETTINGS_MENU, false, -1);
        }

        return waitUntil(
            async () => IsPauseMenuActive() && IsFrontendReadyForControl() && this.getPage() === NATIVE_LANDING_PAGE,
            PAGE_TIMEOUT
        );
    }

    private async enterCategory(category: number): Promise<boolean> {
        if (!(await this.moveToRow(category))) {
            return false;
        }

        await this.press(Control.FrontendAccept);

        return waitUntil(async () => this.getPage() === NATIVE_SETTINGS_PAGE, PAGE_TIMEOUT);
    }

    private async goToRow(row: number): Promise<boolean> {
        return this.moveToRow(row);
    }

    private async moveToRow(row: number): Promise<boolean> {
        for (let presses = 0; presses < MAX_LIST_PRESSES; presses++) {
            if (this.getRow() === row) {
                return true;
            }

            await this.press(Control.FrontendDown);
        }

        return this.getRow() === row;
    }

    private async closeAll(): Promise<void> {
        for (let presses = 0; presses < MAX_CLOSE_PRESSES && IsPauseMenuActive(); presses++) {
            await this.press(Control.FrontendCancel);
        }

        if (IsPauseMenuActive()) {
            SetFrontendActive(false);
        }
    }
}
