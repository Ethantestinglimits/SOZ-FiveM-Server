import { Command } from '../../core/decorators/command';
import { On, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { ClientEvent } from '../../shared/event';
import { HudComponent } from '../../shared/hud';
import { NuiDispatch } from '../nui/nui.dispatch';
import { HudMinimapProvider } from './hud.minimap.provider';

const ALLOWED_RETICLE_WEAPONS = new Set([
    GetHashKey('WEAPON_RPG'),
    GetHashKey('WEAPON_SNIPERRIFLE'),
    GetHashKey('WEAPON_HEAVYSNIPER'),
    GetHashKey('WEAPON_HEAVYSNIPER_MK2'),
    GetHashKey('WEAPON_MARKSMANRIFLE'),
    GetHashKey('WEAPON_MARKSMANRIFLE_MK2'),
]);

const CINEMATIC_BAR_HEIGHT = 0.1;
export const CINEMATIC_TOGGLE_DURATION = 750;

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

@Provider()
export class HudStateProvider {
    @Inject(NuiDispatch)
    private readonly nuiDispatch: NuiDispatch;

    @Inject(HudMinimapProvider)
    private readonly hudMinimapProvider: HudMinimapProvider;

    private isHudVisible = true;

    private isCinematicMode = false;
    private cinematicAnimationFrom = 0;
    private cinematicAnimationStart = 0;
    private cinematicAnimationDuration = 0;

    private isPhoneCameraMode = false;

    private isCinematicCameraActive = false;

    private isCrosshairVisible = false;

    private _isComputedHudVisible = true;

    public get isComputedHudVisible(): boolean {
        return this._isComputedHudVisible;
    }

    public getState() {
        return {
            isHudVisible: this.isHudVisible,
            isCinematicMode: this.isCinematicMode,
            isPhoneCameraMode: this.isPhoneCameraMode,
            isCinematicCameraActive: this.isCinematicCameraActive,
        };
    }

    public setHudVisible(visible: boolean): void {
        this.isHudVisible = visible;
        this.updateHudState();
    }

    public setCinematicMode(enabled: boolean, transitionTime = 0): void {
        this.cinematicAnimationFrom = this.getCinematicProgress();
        this.cinematicAnimationStart = GetGameTimer();
        this.cinematicAnimationDuration = transitionTime;
        this.isCinematicMode = enabled;
        this.updateHudState(transitionTime);
    }

    @Command('hud-cinematic-toggle', {
        description: 'Active/Désactive les barres noires',
        keys: [
            {
                mapper: 'keyboard',
                key: '',
            },
        ],
    })
    public toggleCinematicMode(): void {
        this.setCinematicMode(!this.isCinematicMode, CINEMATIC_TOGGLE_DURATION);
    }

    private getCinematicProgress(): number {
        const target = this.isCinematicMode ? 1 : 0;
        const elapsed = GetGameTimer() - this.cinematicAnimationStart;

        if (this.cinematicAnimationDuration <= 0 || elapsed >= this.cinematicAnimationDuration) {
            return target;
        }

        const t = easeInOutCubic(Math.max(0, elapsed) / this.cinematicAnimationDuration);

        return this.cinematicAnimationFrom + (target - this.cinematicAnimationFrom) * t;
    }

    public setCinematicCameraActive(enabled: boolean): void {
        DisableVehiclePassengerIdleCamera(!enabled);
        this.isCinematicCameraActive = enabled;
    }

    @OnEvent(ClientEvent.PLAYER_UPDATE_CROSSHAIR)
    public setCrosshairVisible(visible: boolean): void {
        this.isCrosshairVisible = visible;
    }

    private updateHudState(transitionTime = 0): void {
        this._isComputedHudVisible = this.isHudVisible && !this.isCinematicMode && !this.isPhoneCameraMode;

        this.hudMinimapProvider.showHud = this._isComputedHudVisible;
        this.nuiDispatch.dispatch('global', 'HideHud', !this._isComputedHudVisible);
        this.nuiDispatch.dispatch('hud', 'SetCinematicHud', {
            active: this.isHudVisible && this.isCinematicMode && !this.isPhoneCameraMode,
            duration: transitionTime,
        });
    }

    @Tick()
    public async disableHudLoop(): Promise<void> {
        // Basic components hide
        HideHudComponentThisFrame(HudComponent.WantedStars);
        HideHudComponentThisFrame(HudComponent.WeaponIcon);
        HideHudComponentThisFrame(HudComponent.Cash);
        HideHudComponentThisFrame(HudComponent.MpCash);
        HideHudComponentThisFrame(HudComponent.AreaName);
        HideHudComponentThisFrame(HudComponent.VehicleClass);
        HideHudComponentThisFrame(HudComponent.StreetName);
        HideHudComponentThisFrame(HudComponent.CashChange);
        HideHudComponentThisFrame(HudComponent.SavingGame);
        HideHudComponentThisFrame(HudComponent.WeaponWheel);
        HideHudComponentThisFrame(HudComponent.WeaponWheelStats);
        HideHudComponentThisFrame(HudComponent.HudComponents);
        HideHudComponentThisFrame(HudComponent.HudWeapons);

        if (!this.isHudVisible) {
            HideHelpTextThisFrame();
            HideHudAndRadarThisFrame();
            HideHudComponentThisFrame(HudComponent.SubtitleText);
            HideHudComponentThisFrame(HudComponent.GameStream);
        }

        if (this.isCinematicCameraActive) {
            ForceCinematicRenderingThisUpdate(true);
        }

        const cinematicProgress = this.getCinematicProgress();
        if (cinematicProgress > 0) {
            const offset = cinematicProgress * CINEMATIC_BAR_HEIGHT - CINEMATIC_BAR_HEIGHT / 2;

            DrawRect(0.5, offset, 1.0, CINEMATIC_BAR_HEIGHT, 0, 0, 0, 255);
            DrawRect(0.5, 1 - offset, 1.0, CINEMATIC_BAR_HEIGHT, 0, 0, 0, 255);
        }

        // handle reticle
        const ped = PlayerPedId();
        const [, weapon] = GetCurrentPedWeapon(ped, true);

        if (!this.isCrosshairVisible && !ALLOWED_RETICLE_WEAPONS.has(weapon)) {
            HideHudComponentThisFrame(HudComponent.Reticle);
        }
    }

    @On(ClientEvent.PHONE_CAMERA_OPEN)
    public enterCamera(): void {
        this.isPhoneCameraMode = true;
        this.updateHudState();
    }

    @On(ClientEvent.PHONE_CAMERA_CLOSE)
    public exitCamera(): void {
        this.isPhoneCameraMode = false;
        this.updateHudState();
    }
}
