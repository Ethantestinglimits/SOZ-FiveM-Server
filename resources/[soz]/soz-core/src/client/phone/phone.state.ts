import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { Tick } from '@core/decorators/tick';
import { emitRpc } from '@core/rpc';
import { wait } from '@core/utils';
import { AnimationService } from '@public/client/animation/animation.service';
import { NuiDispatch } from '@public/client/nui/nui.dispatch';
import { AttachedObjectService } from '@public/client/object/attached.object.service';
import { PlayerService } from '@public/client/player/player.service';
import { ResourceLoader } from '@public/client/repository/resource.loader';
import { StateSelector } from '@public/client/store/store';
import { PlayerUpdate } from '@public/core/decorators/player';
import { ClientEvent } from '@public/shared/event/client';
import { PhoneDevice, PhoneDeviceSettings } from '@public/shared/phone/device';
import { ActiveCall } from '@public/shared/phone/simcard';
import { PlayerData } from '@public/shared/player';
import { RpcServerEvent } from '@public/shared/rpc';

const KVP_PHONE_PROP_MODEL = 'soz_phone_prop_model';
const PHONE_SWITCH_ANIMATION_DELAY = 750;

@Provider()
export class PhoneState {
    @Inject(NuiDispatch)
    private readonly nuiDispatch: NuiDispatch;

    @Inject(AnimationService)
    private readonly animationService: AnimationService;

    @Inject(AttachedObjectService)
    private readonly attachedObjectService: AttachedObjectService;

    @Inject(ResourceLoader)
    private readonly resourceLoader: ResourceLoader;

    @Inject(PlayerService)
    private readonly playerService: PlayerService;

    private phonePropModel = GetResourceKvpString(KVP_PHONE_PROP_MODEL) ?? 'soz_phone_black';
    private phoneProp: number | null = null;

    private phoneOpen = false;
    private phoneDisabled = false;
    private phoneDrowned = false;
    private cityIsInBlackOut = false;

    private phoneFlashlightEnabled = false;
    private phoneOnCamera = false;
    private phoneFrontCameraEnabled = false;

    private currentCall: ActiveCall | null = null;

    private openedDevice: PhoneDevice | null = null;

    @PlayerUpdate()
    public onPlayerUpdate(player: PlayerData) {
        this.nuiDispatch.dispatch('phone', 'SetAvailability', !this.phoneDisabled || player.metadata.isdead);
    }

    public setPhonePropModel(
        model: 'soz_phone_black' | 'soz_phone_gold' | 'soz_phone_natural' | 'soz_phone_white' | 'soz_phone_diamond'
    ) {
        this.phonePropModel = model;
        SetResourceKvp(KVP_PHONE_PROP_MODEL, model);
    }

    public setPhonePropModelFromFrame(frame: string) {
        switch (frame) {
            case 'gold.webp':
                this.setPhonePropModel('soz_phone_gold');
                break;
            case 'natural.webp':
                this.setPhonePropModel('soz_phone_natural');
                break;
            case 'white.webp':
                this.setPhonePropModel('soz_phone_white');
                break;
            case 'casino_diamond.webp':
                this.setPhonePropModel('soz_phone_diamond');
                break;
            case 'black.webp':
            default:
                this.setPhonePropModel('soz_phone_black');
        }
    }

    public isPhoneDisabled() {
        return this.cityIsInBlackOut || this.phoneDrowned || this.phoneDisabled;
    }

    public isPhoneDrowned() {
        return this.phoneDrowned;
    }

    public setPhoneDrowned(value: boolean) {
        this.phoneDrowned = value;
        if (value) {
            this.setPhoneOpen(false);
        }
    }

    public isPhoneOpen() {
        return this.phoneOpen;
    }

    public setPhoneOpen(value: boolean) {
        this.phoneOpen = value;
        this.nuiDispatch.dispatch('phone', 'SetVisibility', value);
    }

    public setPhoneFocus(value: boolean) {
        this.nuiDispatch.dispatch('phone', 'SetPhoneDisableFocus', !value);
    }

    public setPhoneDisabled(value: boolean) {
        this.phoneDisabled = value;
        const player = this.playerService.getPlayer();
        this.nuiDispatch.dispatch('phone', 'SetAvailability', !this.phoneDisabled || player.metadata.isdead);

        if (value) {
            this.setPhoneOpen(false);
            this.setPhoneOnCamera(false);
            this.setPhoneFrontCameraEnabled(false);
            this.setPhoneFlashlightEnabled(false);
        }
    }

    public isPhoneOnCamera() {
        return this.phoneOnCamera;
    }

    public isPhoneFrontCameraEnabled() {
        return this.phoneFrontCameraEnabled;
    }

    public setPhoneOnCamera(value: boolean) {
        this.phoneOnCamera = value;
    }

    public setPhoneFrontCameraEnabled(value: boolean) {
        if (this.phoneFrontCameraEnabled === value) return;

        this.phoneFrontCameraEnabled = value;
        Citizen.invokeNative('0x2491A93618B7D838', value);
    }

    public setPhoneFlashlightEnabled(value: boolean) {
        this.phoneFlashlightEnabled = value;

        if (this.phoneProp) {
            emitRpc(RpcServerEvent.PHONE_LIGHT_SET_FLASHLIGHT, ObjToNet(this.phoneProp), value);
        }
    }

    public getOpenedDevice(): PhoneDevice | null {
        return this.openedDevice;
    }

    public setOpenedDevice(device: PhoneDevice | null) {
        const previous = this.openedDevice;

        this.openedDevice = device;

        if (device?.settings?.frame?.value) {
            this.setPhonePropModelFromFrame(device.settings.frame.value);
        }

        this.nuiDispatch.dispatch('phone', 'SetPhoneDevice', device);
        this.nuiDispatch.dispatch('phone', 'SetSimCard', device?.simNumber || '');

        if (this.currentCall) {
            this.dispatchCurrentCall();
        }

        if (
            previous?.id !== device?.id ||
            previous?.simNumber !== device?.simNumber ||
            previous?.isLocked !== device?.isLocked ||
            previous?.initialized !== device?.initialized
        ) {
            TriggerEvent(ClientEvent.PHONE_DEVICE_RELOAD);
        }
    }

    public async switchOpenedDevice(device: PhoneDevice | null) {
        if (!this.phoneOpen || this.openedDevice?.id === device?.id) {
            this.setOpenedDevice(device);

            return;
        }

        this.setPhoneFrontCameraEnabled(false);
        this.setPhoneFlashlightEnabled(false);
        this.setPhoneOpen(false);
        TriggerEvent(ClientEvent.PHONE_IS_INSIDE_INPUT, { insideInput: false });

        await wait(PHONE_SWITCH_ANIMATION_DELAY);

        this.setOpenedDevice(device);
        this.setPhoneOpen(true);
    }

    public updateOpenedDeviceSettings(settings: PhoneDeviceSettings) {
        if (!this.openedDevice) {
            return;
        }

        this.openedDevice = { ...this.openedDevice, settings };
    }

    public isCallHiddenFromDisplay(call: ActiveCall | null): boolean {
        return Boolean(call) && !call.isTransmitter && Boolean(this.openedDevice) && !this.openedDevice.isMain;
    }

    public dispatchCurrentCall() {
        const call = this.currentCall;

        this.nuiDispatch.dispatch('phone', 'SetCurrentCall', this.isCallHiddenFromDisplay(call) ? null : call);
    }

    public getCurrentCall() {
        return this.currentCall;
    }

    public getTargetCallerId() {
        if (!this.currentCall) return null;

        return this.currentCall.isTransmitter ? this.currentCall.receiverSource : this.currentCall.transmitterSource;
    }

    public setCurrentCall(call: ActiveCall | null) {
        this.currentCall = call;
    }

    public isInCall() {
        return this.currentCall !== null;
    }

    public isInActiveCall() {
        return this.currentCall !== null && (this.currentCall.isTransmitter || this.currentCall.is_accepted);
    }

    @StateSelector(state => state.global.blackout, state => state.global.blackoutLevel)
    async onBlackout(blackout: boolean, blackoutLevel: number) {
        this.cityIsInBlackOut = blackout || blackoutLevel >= 3;
    }

    @Tick(250)
    async onAnimationTick() {
        const playerPed = PlayerPedId();
        const isPlayerInVehicle = IsPedInAnyVehicle(playerPed, false);

        if (this.playerService.getState().isDead) return;
        if (this.phoneOnCamera) return;

        if (this.isInActiveCall()) {
            await this.triggerAnimation(
                playerPed,
                isPlayerInVehicle ? 'anim@cellphone@in_car@ps' : 'cellphone@',
                'cellphone_call_listen_base'
            );
        } else if (this.phoneOpen && this.phoneProp && this.phoneFlashlightEnabled) {
            await this.triggerAnimation(
                playerPed,
                isPlayerInVehicle ? 'anim@cellphone@in_car@ps' : 'cellphone@',
                'cellphone_text_read_base_cover_low'
            );
        } else if (this.phoneOpen) {
            await this.triggerAnimation(
                playerPed,
                isPlayerInVehicle ? 'anim@cellphone@in_car@ps' : 'cellphone@',
                'cellphone_text_in'
            );
        } else if (!this.phoneOpen && this.phoneProp !== null) {
            if (isPlayerInVehicle) {
                ['cellphone_text_in', 'cellphone_call_to_text', 'cellphone_call_listen_base'].forEach(anim => {
                    this.clearAnimation(playerPed, 'anim@cellphone@in_car@ps', anim);
                });
            } else {
                this.clearAnimation(playerPed, 'cellphone@', 'cellphone_text_in');
                this.clearAnimation(playerPed, 'cellphone@', 'cellphone_text_read_base_cover_low');

                this.animationService.playAnimationIfNotRunning({
                    base: {
                        dictionary: isPlayerInVehicle ? 'anim@cellphone@in_car@ps' : 'cellphone@',
                        name: 'cellphone_text_out',
                        duration: 200,
                        options: {
                            onlyUpperBody: true,
                            enablePlayerControl: true,
                        },
                    },
                });
            }
        }

        if (this.phoneOpen) {
            await this.createPhoneProp();
        } else if (!this.isInCall()) {
            await this.removePhoneProp();
        }
    }

    private async createPhoneProp() {
        if (this.phoneProp !== null) return;

        SetPedConfigFlag(PlayerPedId(), 104, false);
        this.phoneProp = await this.attachedObjectService.attachObjectToPlayer({
            bone: 28422,
            model: this.phonePropModel,
            position: [0, 0.0, 0.0],
            rotation: [0, 0, 0],
            rotationOrder: 1,
        });

        emitRpc(RpcServerEvent.PHONE_LIGHT_ADD_PHONE, ObjToNet(this.phoneProp));
    }

    private async removePhoneProp() {
        if (this.phoneProp === null) return;

        emitRpc(RpcServerEvent.PHONE_LIGHT_REMOVE_PHONE, ObjToNet(this.phoneProp));

        SetPedConfigFlag(PlayerPedId(), 104, true);
        this.attachedObjectService.detachObjectToPlayer(this.phoneProp);
        this.phoneProp = null;
    }

    private async triggerAnimation(playerPed: number, dictionary: string, name: string) {
        if (IsEntityPlayingAnim(playerPed, dictionary, name, 3)) return;

        await this.resourceLoader.loadAnimationDictionary(dictionary);
        TaskPlayAnim(playerPed, dictionary, name, 8.0, -1, -1, 50, 0, false, false, false);
    }

    private clearAnimation(playerPed: number, dictionary: string, name: string) {
        if (!IsEntityPlayingAnim(playerPed, dictionary, name, 3)) return;

        StopAnimTask(playerPed, dictionary, name, 3);
    }
}
