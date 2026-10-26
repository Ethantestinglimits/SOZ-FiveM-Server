import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { NuiEvent, ServerEvent } from '../../shared/event';
import { Control } from '../../shared/input';
import { JobService } from '../job/job.service';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PlayerService } from '../player/player.service';
import { JobGradeRepository } from '../repository/job.grade.repository';
import { BlurService } from '../utils/blur.service';

const BLUR_REASON = 'pause_menu';
const BLUR_DELAY = 250;
const NUI_FOCUS_COOLDOWN = 300;
const FRONTEND_OPEN_TIMEOUT = 2000;
const FRONTEND_MENU = GetHashKey('FE_MENU_VERSION_MP_PAUSE');

@Provider()
export class PauseMenuProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(JobService)
    private jobService: JobService;

    @Inject(JobGradeRepository)
    private jobGradeRepository: JobGradeRepository;

    @Inject(BlurService)
    private blurService: BlurService;

    private opened = false;
    private lastNuiFocusAt = 0;
    private frontendRequestedAt: number | null = null;
    private frontendOpened = false;

    public isOpen(): boolean {
        return this.opened;
    }

    @Tick(TickInterval.EVERY_FRAME)
    public onTick(): void {
        if (this.opened) {
            DisableControlAction(0, Control.FrontendPause, true);
            DisableControlAction(0, Control.FrontendPauseAlternate, true);

            return;
        }

        if (this.checkFrontendReturn()) {
            return;
        }

        if (IsNuiFocused() || !IsGameplayCamRendering()) {
            this.lastNuiFocusAt = GetGameTimer();

            return;
        }

        if (IsPauseMenuActive()) {
            return;
        }

        DisableControlAction(0, Control.FrontendPause, true);
        DisableControlAction(0, Control.FrontendPauseAlternate, true);

        if (
            (IsDisabledControlJustPressed(0, Control.FrontendPause) ||
                IsDisabledControlJustPressed(0, Control.FrontendPauseAlternate)) &&
            GetGameTimer() - this.lastNuiFocusAt > NUI_FOCUS_COOLDOWN
        ) {
            this.open();
        }
    }

    public open(): void {
        const player = this.playerService.getPlayer();

        if (!player || this.opened) {
            return;
        }

        this.opened = true;
        this.blurService.add(BLUR_REASON, BLUR_DELAY);

        const job = this.jobService.getJob(player.job.id);
        const grade = this.jobGradeRepository.find(Number(player.job.grade));

        this.nuiDispatch.dispatch('pause_menu', 'Open', {
            firstname: player.charinfo.firstname,
            lastname: player.charinfo.lastname,
            job: job?.label ?? null,
            grade: grade && grade.jobId === player.job.id ? grade.name : null,
            onDuty: player.job.onduty,
            serverId: GetPlayerServerId(PlayerId()),
        });
    }

    public close(): void {
        this.frontendRequestedAt = null;
        this.frontendOpened = false;

        if (!this.opened) {
            return;
        }

        this.opened = false;
        this.lastNuiFocusAt = GetGameTimer();
        this.blurService.remove(BLUR_REASON, BLUR_DELAY);
        this.nuiDispatch.dispatch('pause_menu', 'Close');
    }

    @OnNuiEvent(NuiEvent.PauseMenuClose)
    public async onClose(): Promise<void> {
        this.close();
    }

    @OnNuiEvent(NuiEvent.PauseMenuOpenNative)
    public async onOpenNative(): Promise<void> {
        this.close();
        this.frontendRequestedAt = GetGameTimer();
        ActivateFrontendMenu(FRONTEND_MENU, false, -1);
    }

    @OnNuiEvent(NuiEvent.PauseMenuQuit)
    public async onQuit(): Promise<void> {
        this.close();
        TriggerServerEvent(ServerEvent.PAUSE_MENU_QUIT);
    }

    private checkFrontendReturn(): boolean {
        if (this.frontendRequestedAt !== null) {
            if (IsPauseMenuActive()) {
                this.frontendRequestedAt = null;
                this.frontendOpened = true;
            } else if (GetGameTimer() - this.frontendRequestedAt > FRONTEND_OPEN_TIMEOUT) {
                this.frontendRequestedAt = null;
            }

            return true;
        }

        if (this.frontendOpened && !IsPauseMenuActive()) {
            this.frontendOpened = false;
            this.open();

            return true;
        }

        return this.frontendOpened;
    }
}
