import { Injectable } from '../../core/decorators/injectable';
import { PauseServerSettingValue } from '../../shared/nui/pause_settings';

export type PauseSettingHandler = {
    get: () => PauseServerSettingValue;
    apply: (value: PauseServerSettingValue) => void | Promise<void>;
};

@Injectable()
export class PauseSettingsRegistry {
    private handlers = new Map<string, PauseSettingHandler>();

    public register(key: string, handler: PauseSettingHandler): void {
        this.handlers.set(key, handler);
    }

    public get(key: string): PauseSettingHandler | undefined {
        return this.handlers.get(key);
    }

    public values(): Record<string, PauseServerSettingValue> {
        const values: Record<string, PauseServerSettingValue> = {};

        for (const [key, handler] of this.handlers) {
            values[key] = handler.get();
        }

        return values;
    }
}
