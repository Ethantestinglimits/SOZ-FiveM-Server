import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { wait } from '../../core/utils';
import { NuiEvent } from '../../shared/event';
import { PauseGraphicsRow } from '../../shared/nui/pause_menu';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMenuProvider } from './pause.menu.provider';

const PAUSE_MENU = GetHashKey('FE_MENU_VERSION_MP_PAUSE');
const SETTINGS_TAB = 6;
const GRAPHICS_CATEGORY = 6;
const GRAPHICS_PAGE = 51;
const CONTROL_DOWN = 187;
const CONTROL_APPLY = 203;
const ENTER_CONTROLS = [18, 176, 191, 201, 215, 255];
const COLUMN = 1;
const INPUT_LEFT = 10;
const INPUT_RIGHT = 11;
const CONTROL_ACCEPT = 201;
const PRESS_GAP_FRAMES = 3;
const SELECT_LIMIT = 80;
const READY_TIMEOUT = 3000;
const ROW_CHUNK = 30;
const ROW_READ_LIMIT = 200;
const ROW_READ_TIMEOUT = 1000;
const ROW_TYPE_SLIDER = 2;
const CYCLE_ROWS = [60, 81];

const parseRows = (text: string): PauseGraphicsRow[] =>
    text
        .split('~')
        .filter(Boolean)
        .map((line) => {
            const [slot, , id, type, value, selectable, label, ...rest] = line.split('|');
            const slider = Number(type) === ROW_TYPE_SLIDER;

            return {
                slot: Number(slot),
                id: Number(id),
                type: Number(type),
                value: Number(value),
                selectable: selectable === '1',
                label: label ?? '',
                options: slider ? [] : rest,
                max: slider ? Number(rest[0]) : 0,
            };
        });

type Task =
    | { kind: 'select'; index: number; value: number; control: number; presses: number }
    | { kind: 'press'; control: number }
    | { kind: 'pressAll'; controls: number[] }
    | { kind: 'scaleform'; method: string; args: number[] }
    | { kind: 'wait'; frames: number }
    | { kind: 'done'; resolve: () => void };

@Provider()
export class PauseGraphicsProvider {
    @Inject(PauseMenuProvider)
    private pauseMenuProvider: PauseMenuProvider;

    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    private tasks: Task[] = [];
    private cooldown = 0;
    private active = false;
    private applying = false;
    private closeRequested = false;
    private opening: Promise<void> | null = null;
    private cachedRows: PauseGraphicsRow[] | null = null;

    private run(tasks: Task[]): Promise<void> {
        if (!this.active) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.tasks.push(...tasks, { kind: 'done', resolve });
        });
    }

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
            case 'pressAll':
                for (const control of task.controls) {
                    SetControlNormal(0, control, 1.0);
                    SetControlNormal(2, control, 1.0);
                }

                this.cooldown = PRESS_GAP_FRAMES;
                this.tasks.shift();
                break;
            case 'scaleform':
                if (BeginScaleformMovieMethodOnFrontend(task.method)) {
                    task.args.forEach((value) => ScaleformMovieMethodAddParamInt(value));
                    EndScaleformMovieMethod();
                }

                this.cooldown = PRESS_GAP_FRAMES;
                this.tasks.shift();
                break;
            case 'press':
                SetControlNormal(2, task.control, 1.0);
                this.cooldown = PRESS_GAP_FRAMES;
                this.tasks.shift();
                break;
            case 'select':
                if (GetPauseMenuSelectionData()[task.index] === task.value || task.presses >= SELECT_LIMIT) {
                    this.tasks.shift();
                    break;
                }

                SetControlNormal(2, task.control, 1.0);
                task.presses++;
                this.cooldown = PRESS_GAP_FRAMES;
                break;
        }
    }

    private async waitReady(): Promise<boolean> {
        const start = GetGameTimer();

        while (GetGameTimer() - start < READY_TIMEOUT) {
            if (IsPauseMenuActive() && IsFrontendReadyForControl()) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        return false;
    }

    private async readText(): Promise<string | null> {
        let text = '';

        for (let reads = 0; reads < ROW_READ_LIMIT; reads++) {
            if (!BeginScaleformMovieMethodOnFrontend('GET_COLUMN_SELECTION')) {
                return null;
            }

            ScaleformMovieMethodAddParamInt(COLUMN);
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

    private async sendRows(): Promise<void> {
        const text = await this.readText();

        if (!this.active) {
            return;
        }

        this.cachedRows = parseRows(text ?? '');
        this.nuiDispatch.dispatch('pause_menu', 'GraphicsRows', this.cachedRows);
    }

    @OnNuiEvent(NuiEvent.PauseMenuGraphicsOpen)
    public async onOpen(): Promise<void> {
        if (!this.pauseMenuProvider.isOpen()) {
            return;
        }

        if (this.cachedRows) {
            this.nuiDispatch.dispatch('pause_menu', 'GraphicsRows', this.cachedRows);
        }

        if (this.active) {
            this.closeRequested = false;

            return;
        }

        this.opening = this.open();
        await this.opening;
        this.opening = null;
    }

    private async open(): Promise<void> {
        const start = GetGameTimer();

        this.active = true;

        while (IsPauseMenuActive() && GetGameTimer() - start < READY_TIMEOUT) {
            await wait(0);
        }

        if (IsPauseMenuActive() || !this.active || !this.pauseMenuProvider.isOpen()) {
            this.active = false;

            return;
        }

        ActivateFrontendMenu(PAUSE_MENU, false, SETTINGS_TAB);

        if (!(await this.waitReady())) {
            this.active = false;

            return;
        }

        await this.run([
            { kind: 'wait', frames: 20 },
            { kind: 'press', control: CONTROL_ACCEPT },
            { kind: 'wait', frames: 15 },
            { kind: 'select', index: 2, value: GRAPHICS_CATEGORY, control: CONTROL_DOWN, presses: 0 },
        ]);
        await this.run([
            { kind: 'press', control: CONTROL_ACCEPT },
            { kind: 'wait', frames: 5 },
        ]);

        await this.sendRows();
    }

    @OnNuiEvent(NuiEvent.PauseMenuGraphicsStep)
    public async onStep({ index, id, direction }: { index: number; id: number; direction: number }): Promise<void> {
        await this.opening;

        if (!this.active) {
            return;
        }

        await this.run([
            { kind: 'scaleform', method: 'SET_COLUMN_HIGHLIGHT', args: [COLUMN, index] },
            {
                kind: 'scaleform',
                method: 'SET_COLUMN_INPUT_EVENT',
                args: [COLUMN, direction > 0 ? INPUT_RIGHT : INPUT_LEFT],
            },
        ]);

        if (CYCLE_ROWS.includes(id)) {
            await this.sendRows();
        }
    }

    @OnNuiEvent(NuiEvent.PauseMenuGraphicsSet)
    public async onSet({ id, value }: { id: number; value: number }): Promise<void> {
        await this.opening;

        if (!this.active) {
            return;
        }

        await this.run([{ kind: 'scaleform', method: 'GET_COLUMN_SELECTION', args: [COLUMN, 2, id, value] }]);
    }

    @OnNuiEvent(NuiEvent.PauseMenuGraphicsApply)
    public async onApply(): Promise<void> {
        await this.opening;

        if (!this.active || this.applying) {
            return;
        }

        this.applying = true;

        const inColumn = GetPauseMenuSelectionData()[0] === GRAPHICS_PAGE;

        await this.run([
            ...(inColumn
                ? []
                : ([
                      { kind: 'press', control: CONTROL_ACCEPT },
                      { kind: 'wait', frames: 10 },
                  ] as Task[])),
            { kind: 'pressAll', controls: [CONTROL_APPLY] },
            { kind: 'wait', frames: 10 },
        ]);

        await this.run([
            { kind: 'pressAll', controls: ENTER_CONTROLS },
            { kind: 'wait', frames: 30 },
        ]);
        await this.run([
            { kind: 'pressAll', controls: ENTER_CONTROLS },
            { kind: 'wait', frames: 10 },
        ]);
        await this.sendRows();
        this.applying = false;

        if (this.closeRequested) {
            this.close();
        }
    }

    @OnNuiEvent(NuiEvent.PauseMenuGraphicsClose)
    public async onClose(): Promise<void> {
        if (!this.active) {
            return;
        }

        if (this.applying) {
            this.closeRequested = true;

            return;
        }

        this.close();
    }

    private close(): void {
        this.closeRequested = false;

        const pending = this.tasks;

        this.tasks = [];
        this.cooldown = 0;
        this.active = false;
        SetFrontendActive(false);
        pending.forEach((task) => task.kind === 'done' && task.resolve());
    }
}
