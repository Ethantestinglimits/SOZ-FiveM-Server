import { DuoAnimations } from '../../config/duo-animation';
import { On } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Rpc } from '../../core/decorators/rpc';
import { DuoAnimationPlayPayload, findDuoAnimationById } from '../../shared/duo-animation';
import { ClientEvent } from '../../shared/event/client';
import { PlayerData } from '../../shared/player';
import { applyOffset, getDistance, getHeadingTowards, Vector3, Vector4 } from '../../shared/polyzone/vector';
import { RpcServerEvent } from '../../shared/rpc';
import { Notifier } from '../notifier';
import { PlayerService } from '../player/player.service';

const REQUEST_MAX_DISTANCE = 3.0;
const ACCEPT_MAX_DISTANCE = 2.0;
const REQUEST_TIMEOUT_MS = 20000;

type PendingRequest = {
    fromId: number;
    animationId: string;
    timeout: ReturnType<typeof setTimeout>;
};

@Provider()
export class DuoAnimationProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(Notifier)
    private notifier: Notifier;

    private pending = new Map<number, PendingRequest>();

    @Rpc(RpcServerEvent.DUO_ANIMATION_REQUEST)
    public async onRequest(source: number, targetId: number, animationId: string) {
        if (source === targetId) return;

        const animation = findDuoAnimationById(DuoAnimations, animationId);
        if (!animation) return;

        const playerSource = this.playerService.getPlayer(source);
        if (!playerSource) return;

        const playerTarget = this.playerService.getPlayer(targetId);
        if (!playerTarget) {
            this.notifier.error(source, "Ce joueur n'est pas disponible.");
            return;
        }

        if (
            this.isIncapacitated(GetPlayerPed(source), playerSource) ||
            this.isIncapacitated(GetPlayerPed(targetId), playerTarget)
        ) {
            this.notifier.error(source, "Impossible: l'un des deux joueurs est mort ou dans le coma.");
            return;
        }

        if (this.pending.has(targetId)) {
            this.notifier.error(source, 'Ce joueur a déjà une demande en attente.');
            return;
        }

        const sourcePosition = GetEntityCoords(GetPlayerPed(source)) as Vector3;
        const targetPosition = GetEntityCoords(GetPlayerPed(targetId)) as Vector3;

        if (getDistance(sourcePosition, targetPosition) > REQUEST_MAX_DISTANCE) {
            this.notifier.error(source, "Ce joueur n'est pas à proximité.");
            return;
        }

        const timeout = setTimeout(() => {
            if (this.pending.get(targetId)?.timeout !== timeout) return;

            this.pending.delete(targetId);
            this.notifier.error(source, "Le joueur n'a pas répondu à votre demande.");
        }, REQUEST_TIMEOUT_MS);

        this.pending.set(targetId, { fromId: source, animationId, timeout });

        TriggerClientEvent(
            ClientEvent.DUO_ANIMATION_REQUEST_RECEIVED,
            targetId,
            `${playerSource.charinfo.firstname} ${playerSource.charinfo.lastname}`,
            animation.label
        );
    }

    @Rpc(RpcServerEvent.DUO_ANIMATION_ACCEPT)
    public async onAccept(source: number) {
        const pending = this.pending.get(source);
        if (!pending) {
            this.notifier.error(source, 'Cette demande a expiré.');
            return;
        }

        clearTimeout(pending.timeout);
        this.pending.delete(source);

        const animation = findDuoAnimationById(DuoAnimations, pending.animationId);
        if (!animation) return;

        const initiatorPed = GetPlayerPed(pending.fromId);
        const targetPed = GetPlayerPed(source);

        if (!initiatorPed) {
            this.notifier.error(source, "Ce joueur n'est plus disponible.");
            return;
        }

        const playerSource = this.playerService.getPlayer(pending.fromId);
        const playerTarget = this.playerService.getPlayer(source);

        if (
            !playerSource ||
            !playerTarget ||
            this.isIncapacitated(initiatorPed, playerSource) ||
            this.isIncapacitated(targetPed, playerTarget)
        ) {
            const message = "Impossible: l'un des deux joueurs est mort ou dans le coma.";
            this.notifier.error(pending.fromId, message);
            this.notifier.error(source, message);
            return;
        }

        const initiatorPosition = GetEntityCoords(initiatorPed) as Vector3;
        const targetPosition = GetEntityCoords(targetPed) as Vector3;

        if (getDistance(initiatorPosition, targetPosition) > ACCEPT_MAX_DISTANCE) {
            const message = 'Vous devez être proches pour réaliser cette animation.';
            this.notifier.error(pending.fromId, message);
            this.notifier.error(source, message);
            return;
        }

        const axisHeading = getHeadingTowards(initiatorPosition, targetPosition);
        const midpoint: Vector3 = [
            (initiatorPosition[0] + targetPosition[0]) / 2,
            (initiatorPosition[1] + targetPosition[1]) / 2,
            (initiatorPosition[2] + targetPosition[2]) / 2,
        ];
        const half = animation.distance / 2;
        const base: Vector4 = [midpoint[0], midpoint[1], midpoint[2], axisHeading];

        const initiatorCoords = applyOffset(base, [0, -half, 0]);
        const targetCoordsRaw = applyOffset(base, [0, half, 0]);
        const targetCoords: Vector4 = [
            targetCoordsRaw[0],
            targetCoordsRaw[1],
            targetCoordsRaw[2],
            (axisHeading + 180) % 360,
        ];

        const initiatorPayload: DuoAnimationPlayPayload = {
            animationId: animation.id,
            role: 'initiator',
            partnerId: source,
            coords: initiatorCoords,
        };
        const targetPayload: DuoAnimationPlayPayload = {
            animationId: animation.id,
            role: 'target',
            partnerId: pending.fromId,
            coords: targetCoords,
        };

        TriggerClientEvent(ClientEvent.DUO_ANIMATION_PLAY, pending.fromId, initiatorPayload);
        TriggerClientEvent(ClientEvent.DUO_ANIMATION_PLAY, source, targetPayload);
    }

    @Rpc(RpcServerEvent.DUO_ANIMATION_DECLINE)
    public async onDecline(source: number) {
        const pending = this.pending.get(source);
        if (!pending) return;

        clearTimeout(pending.timeout);
        this.pending.delete(source);

        this.notifier.error(pending.fromId, 'Votre proposition a été refusée.');
    }

    @On('playerDropped')
    public onPlayerDropped(source: number) {
        const ownRequest = this.pending.get(source);
        if (ownRequest) {
            clearTimeout(ownRequest.timeout);
            this.pending.delete(source);
        }

        for (const [targetId, request] of this.pending.entries()) {
            if (request.fromId !== source) continue;

            clearTimeout(request.timeout);
            this.pending.delete(targetId);
            this.notifier.error(targetId, 'Le joueur a quitté le serveur.');
        }
    }

    private isIncapacitated(ped: number, player: PlayerData): boolean {
        return Boolean(player.metadata.isdead) || Boolean(player.metadata.inlaststand) || GetEntityHealth(ped) <= 0;
    }
}
