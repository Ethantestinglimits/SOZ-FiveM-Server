import { ControlInputNames } from '../../config/controls';
import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { wait } from '../../core/utils';
import { NuiEvent } from '../../shared/event';
import { PauseKeyBinding, PauseKeyCategory } from '../../shared/nui/pause_menu';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMenuProvider } from './pause.menu.provider';

const PAUSE_MENU = GetHashKey('FE_MENU_VERSION_MP_PAUSE');
const SETTINGS_TAB = 6;
const KEYS_MENU = 148;
const KEYS_CATEGORY_MENU = 149;
const RESET_CATEGORY = -3000;
const CONTROL_CANCEL = 202;
const PRESS_GAP_FRAMES = 3;
const PRESS_LIMIT = 30;
const READY_TIMEOUT = 3000;
const ROW_CHUNK = 30;
const ROW_READ_LIMIT = 1000;
const ROW_READ_TIMEOUT = 1000;
const BACKDROP_DELAY = 250;
const CACHE_KVP = 'soz_key_bindings';
const FIVEM_INPUT = /^[0-9A-F]{8}$/;

type Task =
    | { kind: 'wait'; frames: number }
    | { kind: 'until'; control: number; reached: (selection: number[]) => boolean; presses: number }
    | { kind: 'done'; resolve: () => void };

type CachedCategory = Omit<PauseKeyCategory, 'rows'> & { rows: Omit<PauseKeyBinding, 'key'>[] };

const stripTags = (text: string) => text.replace(/<[^>]+>/g, '').trim();

const splitRows = (text: string) =>
    text
        .replace(/~$/, '')
        .split(/~(?=\d+\|-?\d+\|)/)
        .filter(Boolean)
        .map(row => row.split('|'));

@Provider()
export class PauseKeysProvider {
    @Inject(PauseMenuProvider)
    private pauseMenuProvider: PauseMenuProvider;

    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private tasks: Task[] = [];
    private cooldown = 0;
    private active = false;
    private reading: Promise<void> | null = null;
    private categories: CachedCategory[] | null = null;

    @Tick(TickInterval.EVERY_FRAME)
    public process(): void {
        if (this.cooldown > 0) {
            this.cooldown--;

            return;
        }

        const task = this.tasks[0];

        if (!task) {
            return;
        }

        switch (task.kind) {
            case 'done':
                this.tasks.shift();
                task.resolve();
                break;
            case 'wait':
                this.cooldown = task.frames;
                this.tasks.shift();
                break;
            case 'until':
                if (task.reached(GetPauseMenuSelectionData()) || task.presses >= PRESS_LIMIT) {
                    this.tasks.shift();
                    break;
                }

                SetControlNormal(2, task.control, 1.0);
                task.presses++;
                this.cooldown = PRESS_GAP_FRAMES * 5;
                break;
        }
    }

    private run(tasks: Task[]): Promise<void> {
        if (!this.active) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.tasks.push(...tasks, { kind: 'done', resolve });
        });
    }

    private async waitFor(reached: (selection: number[]) => boolean): Promise<boolean> {
        const start = GetGameTimer();

        while (this.active && GetGameTimer() - start < READY_TIMEOUT) {
            if (reached(GetPauseMenuSelectionData())) {
                return true;
            }

            await wait(0);
        }

        return false;
    }

    private press(index: number, column: number): void {
        if (BeginScaleformMovieMethodOnFrontend('M_PRESS_EVENT')) {
            ScaleformMovieMethodAddParamInt(index);
            ScaleformMovieMethodAddParamInt(column);
            EndScaleformMovieMethod();
        }
    }

    private async pressUntil(index: number, column: number, reached: (selection: number[]) => boolean) {
        for (let tries = 0; this.active && tries < PRESS_LIMIT; tries++) {
            if (reached(GetPauseMenuSelectionData())) {
                return true;
            }

            this.press(index, column);
            await this.run([{ kind: 'wait', frames: PRESS_GAP_FRAMES }]);
        }

        return reached(GetPauseMenuSelectionData());
    }

    private async readColumn(column: number): Promise<string | null> {
        let text = '';

        for (let reads = 0; reads < ROW_READ_LIMIT; reads++) {
            if (!BeginScaleformMovieMethodOnFrontend('GET_COLUMN_SELECTION')) {
                return null;
            }

            ScaleformMovieMethodAddParamInt(column);
            ScaleformMovieMethodAddParamInt(1);
            ScaleformMovieMethodAddParamInt(text.length);

            const handle = EndScaleformMovieMethodReturnValue();
            const asked = GetGameTimer();

            while (!IsScaleformMovieMethodReturnValueReady(handle)) {
                if (GetGameTimer() - asked > ROW_READ_TIMEOUT) {
                    return null;
                }

                await wait(0);
            }

            const chunk = GetScaleformMovieMethodReturnValueString(handle);

            text += chunk;

            if (chunk.length < ROW_CHUNK) {
                break;
            }
        }

        return text;
    }

    private async open(): Promise<boolean> {
        const start = GetGameTimer();

        this.active = true;
        this.nuiDispatch.dispatch('pause_menu', 'GraphicsNative', true);

        while (IsPauseMenuActive() && GetGameTimer() - start < READY_TIMEOUT) {
            await wait(0);
        }

        await wait(BACKDROP_DELAY);

        if (IsPauseMenuActive() || !this.active || !this.pauseMenuProvider.isOpen()) {
            this.close();

            return false;
        }

        ActivateFrontendMenu(PAUSE_MENU, false, SETTINGS_TAB);

        if (!(await this.waitFor(() => IsPauseMenuActive() && IsFrontendReadyForControl()))) {
            this.close();

            return false;
        }

        await this.run([
            { kind: 'wait', frames: 10 },
            { kind: 'until', control: CONTROL_CANCEL, reached: selection => selection[0] === SETTINGS_TAB, presses: 0 },
        ]);
        PauseMenuceptionGoDeeper(KEYS_MENU);

        if (!(await this.waitFor(selection => selection[0] === KEYS_MENU))) {
            this.close();

            return false;
        }

        return this.active;
    }

    private close(): void {
        const pending = this.tasks;
        const wasActive = this.active;

        this.tasks = [];
        this.cooldown = 0;
        this.active = false;

        if (wasActive) {
            SetFrontendActive(false);
            setTimeout(() => {
                if (!this.active) {
                    this.nuiDispatch.dispatch('pause_menu', 'GraphicsNative', false);
                }
            }, BACKDROP_DELAY);
        }

        pending.forEach(task => task.kind === 'done' && task.resolve());
    }

    private getKey(input?: string): string | undefined {
        if (!input) {
            return undefined;
        }

        const control = FIVEM_INPUT.test(input)
            ? parseInt(input, 16) | 0x80000000
            : ControlInputNames.indexOf(`INPUT_${input}`);

        if (control === -1) {
            return undefined;
        }

        const button = GetControlInstructionalButton(0, control, true);

        return button?.startsWith('t_') ? button.slice(2) : button || undefined;
    }

    private dispatch(loading: boolean): void {
        this.nuiDispatch.dispatch('pause_menu', 'KeyCategories', {
            loading,
            categories: (this.categories ?? []).map(category => ({
                ...category,
                rows: category.rows.map(row => ({ ...row, key: this.getKey(row.input) })),
            })),
        });
    }

    private parseCategories(text: string): CachedCategory[] {
        return splitRows(text)
            .map(([slot, , id, , , , label]) => ({
                index: Number(slot),
                id: Number(id),
                label: stripTags(label ?? ''),
                rows: [],
            }))
            .filter(category => category.id !== RESET_CATEGORY);
    }

    private parseRows(text: string): Omit<PauseKeyBinding, 'key'>[] {
        return splitRows(text).map(([slot, , , , , , label, primary]) => {
            const clean = stripTags(label ?? '');
            const resource = clean.match(/^\(([^)]+)\)\s*/);

            return {
                slot: Number(slot),
                label: resource ? clean.slice(resource[0].length) : clean,
                resource: resource?.[1],
                input: primary?.match(/~INPUT_([A-Z0-9_]+)~/)?.[1],
            };
        });
    }

    private async readAll(): Promise<void> {
        if (!(await this.open())) {
            return;
        }

        const categories = this.parseCategories((await this.readColumn(0)) ?? '');

        this.categories = [];

        for (const category of categories) {
            const selected = await this.pressUntil(
                category.index,
                0,
                selection => selection[1] === KEYS_CATEGORY_MENU && selection[2] === category.id
            );

            if (!selected) {
                continue;
            }

            await this.run([{ kind: 'wait', frames: PRESS_GAP_FRAMES }]);
            this.categories.push({ ...category, rows: this.parseRows((await this.readColumn(1)) ?? '') });
            this.dispatch(true);
        }

        if (this.categories.length === categories.length && categories.length > 0) {
            SetResourceKvp(CACHE_KVP, JSON.stringify(this.categories));
        }

        this.close();
    }

    private loadCache(): CachedCategory[] | null {
        try {
            const categories = JSON.parse(GetResourceKvpString(CACHE_KVP) ?? 'null');

            return Array.isArray(categories) && categories.length > 0 ? categories : null;
        } catch {
            return null;
        }
    }

    @OnNuiEvent(NuiEvent.PauseMenuKeysOpen)
    public async onOpen(): Promise<void> {
        if (!this.pauseMenuProvider.isOpen()) {
            return;
        }

        this.categories = this.categories ?? this.loadCache();

        if (this.categories) {
            this.dispatch(false);

            return;
        }

        if (!this.reading) {
            this.reading = this.readAll().finally(() => {
                this.reading = null;
            });
        }

        await this.reading;
        this.dispatch(false);
    }

    @OnNuiEvent(NuiEvent.PauseMenuKeysClose)
    public async onClose(): Promise<void> {
        this.close();
    }
}
