import { Once, OnceStep, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { NuiEvent } from '../../shared/event';
import { isNativeSetting, NATIVE_SETTINGS, sanitizeNativeValue } from '../../shared/nui/native_settings';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMenuProvider } from './pause.menu.provider';

const APPLY_COMMAND = 'soz_native_setting';
const PENDING_TIMEOUT = 2000;

@Provider()
export class PauseNativeSettingsProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PauseMenuProvider)
    private pauseMenuProvider: PauseMenuProvider;

    private pending: { changes: { key: string; value: number }[]; at: number } | null = null;

    @Once(OnceStep.Start)
    public registerApplyCommand(): void {
        RegisterCommand(`+${APPLY_COMMAND}`, () => this.apply(), false);
        RegisterCommand(`-${APPLY_COMMAND}`, () => this.apply(), false);
        RegisterKeyMapping(
            `+${APPLY_COMMAND}`,
            'Paramètres : appliquer un réglage du jeu',
            'MOUSE_BUTTON',
            'MOUSE_LEFT',
        );
    }

    @OnNuiEvent(NuiEvent.PauseMenuQueueNative)
    public async onQueue({ changes }: { changes: { key: string; value: number }[] }): Promise<void> {
        if (!this.pauseMenuProvider.isOpen()) {
            return;
        }

        const valid: { key: string; value: number }[] = [];

        for (const { key, value } of changes ?? []) {
            if (!isNativeSetting(key)) {
                continue;
            }

            const sanitized = sanitizeNativeValue(NATIVE_SETTINGS[key], value);

            if (sanitized !== null) {
                valid.push({ key, value: sanitized });
            }
        }

        this.pending = valid.length > 0 ? { changes: valid, at: GetGameTimer() } : null;
    }

    private apply(): void {
        const pending = this.pending;

        this.pending = null;

        if (!pending || !this.pauseMenuProvider.isOpen() || GetGameTimer() - pending.at > PENDING_TIMEOUT) {
            return;
        }

        for (const { key, value } of pending.changes) {
            ExecuteCommand(`${key} ${value}`);
            this.nuiDispatch.dispatch('pause_menu', 'NativeValue', { key, value: GetConvarInt(key, -1) });
        }
    }
}
