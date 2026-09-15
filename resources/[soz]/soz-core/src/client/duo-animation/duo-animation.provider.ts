import { DuoAnimations } from '../../config/duo-animation';
import { OnEvent, OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { emitRpc } from '../../core/rpc';
import { Animation } from '../../shared/animation';
import { DuoAnimationPlayPayload, findDuoAnimationById } from '../../shared/duo-animation';
import { ClientEvent } from '../../shared/event/client';
import { NuiEvent } from '../../shared/event/nui';
import { RpcServerEvent } from '../../shared/rpc';
import { AnimationService } from '../animation/animation.service';
import { Notifier } from '../notifier';
import { NuiMenu } from '../nui/nui.menu';

@Provider()
export class DuoAnimationProvider {
    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(Notifier)
    private notifier: Notifier;

    @Inject(NuiMenu)
    private nuiMenu: NuiMenu;

    private busy = false;

    public isBusy(): boolean {
        return this.busy;
    }

    @OnNuiEvent(NuiEvent.PlayerMenuDuoAnimationRequest)
    public async onMenuRequest({ targetServerId, animationId }: { targetServerId: number; animationId: string }) {
        this.nuiMenu.closeMenu();

        await emitRpc(RpcServerEvent.DUO_ANIMATION_REQUEST, targetServerId, animationId);
    }

    @OnEvent(ClientEvent.DUO_ANIMATION_REQUEST_RECEIVED)
    public async onRequestReceived(fromName: string, animationLabel: string) {
        const [confirmed, timeout] = await this.notifier.notifyWithConfirm(
            `${fromName} vous propose : ~b~${animationLabel}~s~.~n~Faites ~g~Y~s~ pour accepter ou ~r~N~s~ pour refuser`
        );

        if (timeout) {
            return;
        }

        if (!confirmed) {
            await emitRpc(RpcServerEvent.DUO_ANIMATION_DECLINE);
            return;
        }

        await emitRpc(RpcServerEvent.DUO_ANIMATION_ACCEPT);
    }

    @OnEvent(ClientEvent.DUO_ANIMATION_PLAY)
    public async onPlay({ animationId, role, coords }: DuoAnimationPlayPayload) {
        const duoAnimation = findDuoAnimationById(DuoAnimations, animationId);
        if (!duoAnimation) {
            return;
        }

        const slot = role === 'initiator' ? duoAnimation.initiator : duoAnimation.target;
        const animation: Animation = { base: slot };

        const ped = PlayerPedId();

        SetEntityHeading(ped, coords[3]);
        SetEntityCoordsNoOffset(ped, coords[0], coords[1], coords[2], false, false, false);

        this.busy = true;

        try {
            await this.animationService.playAnimation(animation, {
                ped,
                clearTasksBefore: true,
                cancellable: false,
            });
        } finally {
            this.busy = false;
        }
    }
}
