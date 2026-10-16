import { TaserConfig } from '../../config/taser';
import { OnEvent } from '../../core/decorators/event';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { Control } from '../../shared/input';
import { anchorDaze, DazeState, getDazeIntensity } from '../../shared/taser';

const DAZE_DISABLED_CONTROLS = [
    Control.Sprint,
    Control.Aim,
    Control.Attack,
    Control.Attack2,
    Control.MeleeAttack1,
    Control.MeleeAttack2,
    Control.MeleeAttackLight,
    Control.MeleeAttackHeavy,
    Control.MeleeAttackAlternate,
    Control.VehicleAim,
    Control.VehicleAttack,
    Control.VehicleAttack2,
    Control.VehiclePassengerAim,
    Control.VehiclePassengerAttack,
    Control.VehicleFlyAttack,
    Control.VehicleFlyAttack2,
    Control.VehicleFlyAttackCamera,
    Control.VehicleMeleeHold,
    Control.VehicleMeleeLeft,
    Control.VehicleMeleeRight,
];

@Provider()
export class TaserDazeProvider {
    private dazeState: DazeState | null = null;

    private wasElectrocuted = false;

    private swaying = false;

    @OnEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE)
    public onUpdateDaze(duration: number | null) {
        this.dazeState = duration === null ? null : anchorDaze(Date.now(), duration);
    }

    @OnEvent(ClientEvent.PLAYER_ON_DEATH)
    @OnEvent(ClientEvent.LSMC_REVIVE)
    public onPurgeDaze() {
        this.wasElectrocuted = false;
        TriggerEvent(ClientEvent.PLAYER_TASER_UPDATE_DAZE, null);
    }

    @Tick(100)
    public onElectrocutionTick() {
        const playerPed = PlayerPedId();

        if (IsPedBeingStunned(playerPed, 0)) {
            this.wasElectrocuted = true;

            return;
        }

        if (this.wasElectrocuted && !IsPedRagdoll(playerPed)) {
            this.wasElectrocuted = false;

            TriggerServerEvent(ServerEvent.PLAYER_TASER_ELECTROCUTION_ENDED);
        }
    }

    @Tick(TickInterval.EVERY_FRAME)
    public onDisableControlsTick() {
        if (!this.dazeState) {
            return;
        }

        for (const control of DAZE_DISABLED_CONTROLS) {
            DisableControlAction(0, control, true);
        }

        DisablePlayerFiring(PlayerId(), true);
    }

    @Tick(100)
    public onCameraSwayTick() {
        if (!this.dazeState) {
            if (this.swaying) {
                StopGameplayCamShaking(true);
                this.swaying = false;
            }

            return;
        }

        if (!this.swaying) {
            ShakeGameplayCam(TaserConfig.cameraSway.shake, TaserConfig.cameraSway.maxAmplitude);
            this.swaying = true;
        }

        SetGameplayCamShakeAmplitude(
            getDazeIntensity(this.dazeState, Date.now()) * TaserConfig.cameraSway.maxAmplitude,
        );
    }
}
