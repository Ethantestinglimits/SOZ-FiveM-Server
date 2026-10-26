import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { BlipType } from '../../shared/blip';
import { NuiEvent, ServerEvent } from '../../shared/event';
import { Control } from '../../shared/input';
import { PauseMapLayer, PauseMapPlace, PauseMapRegion } from '../../shared/nui/pause_menu';
import { BlipFactory } from '../blip';
import { JobService } from '../job/job.service';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PlayerService } from '../player/player.service';
import { JobGradeRepository } from '../repository/job.grade.repository';
import { BlurService } from '../utils/blur.service';
import { PauseMinimapProvider } from './minimap.provider';
import { PauseSettingsProvider } from './pause.settings.provider';

const BLUR_REASON = 'pause_menu';
const BLUR_DELAY = 250;
const NUI_FOCUS_COOLDOWN = 300;
const FRONTEND_OPEN_TIMEOUT = 2000;
const FRONTEND_MENU = GetHashKey('FE_MENU_VERSION_MP_PAUSE');
const FRONTEND_SETTINGS_MENU = GetHashKey('FE_MENU_VERSION_LANDING_MENU');
const FRONTEND_KEYS_MENU = GetHashKey('FE_MENU_VERSION_LANDING_KEYMAPPING_MENU');
const MAP_LAYERS_KVP = 'soz_pause_map';
const MAP_LAYERS: PauseMapLayer[] = ['postals', 'regions', 'blips'];
const DEFAULT_MAP_LAYERS: PauseMapLayer[] = ['blips', 'regions'];
const REGION_STEP = 125;
const REGION_BOUNDS = { minX: -3800, maxX: 4400, minY: -4000, maxY: 8000 };
const REGION_EXCLUDED_ZONES = ['OCEANA'];

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

    @Inject(BlipFactory)
    private blipFactory: BlipFactory;

    @Inject(PauseSettingsProvider)
    private pauseSettingsProvider: PauseSettingsProvider;

    @Inject(PauseMinimapProvider)
    private pauseMinimapProvider: PauseMinimapProvider;

    private opened = false;
    private lastNuiFocusAt = 0;
    private frontendRequestedAt: number | null = null;
    private frontendOpened = false;
    private regions: PauseMapRegion[] | null = null;
    private closeWaiters: (() => void)[] = [];

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

    public open(scriptMode = false, focus?: { x: number; y: number }): void {
        const player = this.playerService.getPlayer();

        if (!player || this.opened) {
            return;
        }

        this.opened = true;

        if (!this.pauseMinimapProvider.isPotato()) {
            this.blurService.add(BLUR_REASON, BLUR_DELAY);
        }

        const job = this.jobService.getJob(player.job.id);
        const grade = this.jobGradeRepository.find(Number(player.job.grade));

        this.nuiDispatch.dispatch('pause_menu', 'Open', {
            firstname: player.charinfo.firstname,
            lastname: player.charinfo.lastname,
            job: job?.label ?? null,
            grade: grade && grade.jobId === player.job.id ? grade.name : null,
            onDuty: player.job.onduty,
            serverId: GetPlayerServerId(PlayerId()),
            places: this.getPlaces(),
            regions: this.getRegions(),
            layers: this.getMapLayers(),
            settings: this.pauseSettingsProvider.getSettings(),
            scriptMode,
            focus,
        });
    }

    public openMapForScript(focus?: { x: number; y: number }): Promise<void> {
        return new Promise(resolve => {
            this.pauseMinimapProvider.scanNow();
            this.open(true, focus);

            if (!this.opened) {
                resolve();

                return;
            }

            this.closeWaiters.push(resolve);
        });
    }

    public close(): void {
        this.frontendRequestedAt = null;
        this.frontendOpened = false;

        if (!this.opened) {
            return;
        }

        const waiters = this.closeWaiters;

        this.closeWaiters = [];
        waiters.forEach(resolve => resolve());

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
    public async onOpenNative(data?: { page?: 'settings' | 'keys' }): Promise<void> {
        this.close();
        this.frontendRequestedAt = GetGameTimer();

        const menu =
            data?.page === 'keys'
                ? FRONTEND_KEYS_MENU
                : data?.page === 'settings'
                  ? FRONTEND_SETTINGS_MENU
                  : FRONTEND_MENU;

        ActivateFrontendMenu(menu, false, -1);
    }

    @OnNuiEvent(NuiEvent.PauseMenuSaveMapLayers)
    public async onSaveMapLayers(layers: PauseMapLayer[]): Promise<void> {
        SetResourceKvp(MAP_LAYERS_KVP, JSON.stringify({ layers }));
    }

    @OnNuiEvent(NuiEvent.PauseMenuQuit)
    public async onQuit(): Promise<void> {
        this.close();
        TriggerServerEvent(ServerEvent.PAUSE_MENU_QUIT);
    }

    private getPlaces(): PauseMapPlace[] {
        const places: PauseMapPlace[] = [];

        for (const { id, blip } of this.blipFactory.getAll().values()) {
            if (!blip.name || blip.hidden || blip.type === BlipType.Radius || !blip.position) {
                continue;
            }

            places.push({
                id,
                name: blip.name,
                sprite: blip.sprite ?? 1,
                color: blip.color ?? 0,
                x: blip.position[0],
                y: blip.position[1],
            });
        }

        return places;
    }

    private getRegions(): PauseMapRegion[] {
        if (this.regions) {
            return this.regions;
        }

        const zones = new Map<string, { x: number; y: number; count: number }>();

        for (let x = REGION_BOUNDS.minX; x <= REGION_BOUNDS.maxX; x += REGION_STEP) {
            for (let y = REGION_BOUNDS.minY; y <= REGION_BOUNDS.maxY; y += REGION_STEP) {
                const zone = GetNameOfZone(x, y, 100);

                if (!zone || REGION_EXCLUDED_ZONES.includes(zone)) {
                    continue;
                }

                const sum = zones.get(zone) ?? { x: 0, y: 0, count: 0 };

                zones.set(zone, { x: sum.x + x, y: sum.y + y, count: sum.count + 1 });
            }
        }

        this.regions = [...zones.entries()]
            .map(([zone, sum]) => ({
                name: GetLabelText(zone),
                x: sum.x / sum.count,
                y: sum.y / sum.count,
                weight: sum.count,
            }))
            .filter(region => region.name && region.name !== 'NULL');

        return this.regions;
    }

    private getMapLayers(): PauseMapLayer[] {
        const saved = GetResourceKvpString(MAP_LAYERS_KVP);

        if (!saved) {
            return DEFAULT_MAP_LAYERS;
        }

        try {
            const { layers } = JSON.parse(saved) as { layers?: PauseMapLayer[] };

            return Array.isArray(layers) ? layers.filter(layer => MAP_LAYERS.includes(layer)) : DEFAULT_MAP_LAYERS;
        } catch {
            return DEFAULT_MAP_LAYERS;
        }
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
