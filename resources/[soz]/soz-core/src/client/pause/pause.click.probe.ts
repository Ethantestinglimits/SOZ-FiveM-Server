import { Once, OnceStep } from '../../core/decorators/event';
import { Provider } from '../../core/decorators/provider';

@Provider()
export class PauseClickProbe {
    private pending: { key: string; value: string } | null = null;

    @Once(OnceStep.Start)
    public register(): void {
        RegisterCommand('+soz_pref_click', () => this.apply('clic souris'), false);
        RegisterCommand('-soz_pref_click', () => undefined, false);
        RegisterKeyMapping('+soz_pref_click', 'Test réglage natif (clic)', 'MOUSE_BUTTON', 'MOUSE_LEFT');

        RegisterCommand('+soz_pref_key', () => this.apply('touche F7'), false);
        RegisterCommand('-soz_pref_key', () => undefined, false);
        RegisterKeyMapping('+soz_pref_key', 'Test réglage natif (touche)', 'keyboard', 'F7');

        RegisterCommand(
            'ppend',
            (source: number, args: string[]) => {
                this.pending = { key: args[0], value: args[1] };
                console.log(`[probe-clic] en attente : ${args[0]} ${args[1]}`);
            },
            false
        );
    }

    private apply(origin: string): void {
        if (!this.pending) {
            return;
        }

        const { key, value } = this.pending;
        const before = GetConvarInt(key, -1);

        this.pending = null;
        ExecuteCommand(`${key} ${value}`);

        console.log(`[probe-clic] ${origin} : ${key} ${before} -> demandé ${value}, relu ${GetConvarInt(key, -1)}`);
    }
}
