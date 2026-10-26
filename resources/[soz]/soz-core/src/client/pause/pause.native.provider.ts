import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import { isNativeSetting, NATIVE_SETTINGS, sanitizeNativeValue } from '../../shared/nui/native_settings';
import { NuiDispatch } from '../nui/nui.dispatch';

const APPLY_COMMAND = 'soz_native_setting';
const PENDING_TIMEOUT = 2000;

@Provider()
export class PauseNativeSettingsProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private pending: { key: string; value: number; at: number } | null = null;

    @Once(OnceStep.Start)
    public registerApplyCommand(): void {
        RegisterCommand(`+${APPLY_COMMAND}`, () => this.apply(), false);
        RegisterCommand(`-${APPLY_COMMAND}`, () => this.apply(), false);
        RegisterKeyMapping(`+${APPLY_COMMAND}`, 'Paramètres : appliquer un réglage du jeu', 'MOUSE_BUTTON', 'MOUSE_LEFT');
    }

    @OnNuiEvent(NuiEvent.PauseMenuQueueNative)
    public async onQueue({ key, value }: { key: string; value: number }): Promise<void> {
        if (!isNativeSetting(key)) {
            return;
        }

        const sanitized = sanitizeNativeValue(NATIVE_SETTINGS[key], value);

        if (sanitized === null) {
            return;
        }

        this.pending = { key, value: sanitized, at: GetGameTimer() };
    }

    private apply(): void {
        const pending = this.pending;

        if (!pending || GetGameTimer() - pending.at > PENDING_TIMEOUT) {
            return;
        }

        this.pending = null;
        ExecuteCommand(`${pending.key} ${pending.value}`);
        this.nuiDispatch.dispatch('pause_menu', 'NativeValue', {
            key: pending.key,
            value: GetConvarInt(pending.key, -1),
        });
    }
}
