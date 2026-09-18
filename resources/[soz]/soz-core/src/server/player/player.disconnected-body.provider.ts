import { On, Once, OnceStep, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { PlayerData } from '../../shared/player';
import { DisconnectedBodySnapshot } from '../../shared/player-disconnected-body';
import { Vector4 } from '../../shared/polyzone/vector';
import { PrismaService } from '../database/prisma.service';
import { PlayerService } from './player.service';

type TrackedBody = {
    netId: number;
};

@Provider()
export class PlayerDisconnectedBodyProvider {
    @Inject(PrismaService)
    private prismaService: PrismaService;

    @Inject(PlayerService)
    private playerService: PlayerService;

    private lastKnownState: Record<number, DisconnectedBodySnapshot> = {};

    private bodies: Record<string, TrackedBody> = {};

    @Once(OnceStep.DatabaseConnected)
    public async restoreBodies() {
        const rows = await this.prismaService.disconnected_body.findMany();

        for (const row of rows) {
            const snapshot: DisconnectedBodySnapshot = {
                citizenId: row.citizenid,
                position: JSON.parse(row.position),
                model: Number(row.model),
                skin: JSON.parse(row.skin),
                outfit: JSON.parse(row.outfit),
                animation: row.animation ? JSON.parse(row.animation) : null,
                isDead: row.is_dead,
                vehicleNetId: undefined,
                vehicleSeatIndex: undefined,
            };

            await this.spawnBody(snapshot, false);
        }
    }

    @OnEvent(ServerEvent.PLAYER_BODY_STATE_SYNC)
    public onStateSync(source: number, snapshot: DisconnectedBodySnapshot) {
        this.lastKnownState[source] = snapshot;
    }

    @On('playerDropped')
    public async onPlayerDropped(source: number) {
        const snapshot = this.lastKnownState[source];
        delete this.lastKnownState[source];

        if (!snapshot) {
            return;
        }

        if (!snapshot.isDead) {
            // Best effort: qb-core may have already saved/unloaded the player by the time this runs,
            // in which case this silently does nothing (the mood metadata is a cosmetic nicety, not
            // required for the body itself to spawn correctly).
            this.playerService.setPlayerMetadata(source, 'mood', 'mood_sleeping_1');
        }

        await this.spawnBody(snapshot, true);
    }

    @OnEvent(ServerEvent.PLAYER_LOADED)
    public async onPlayerLoaded(source: number, player: PlayerData) {
        const body = this.bodies[player.citizenid];
        if (!body) {
            return;
        }

        delete this.bodies[player.citizenid];

        let spawnPosition: Vector4 | null = null;
        const entity = NetworkGetEntityFromNetworkId(body.netId);
        if (entity && DoesEntityExist(entity)) {
            const coords = GetEntityCoords(entity);
            const heading = GetEntityHeading(entity);
            spawnPosition = [coords[0], coords[1], coords[2], heading];
            DeleteEntity(entity);
        }

        await this.prismaService.disconnected_body
            .delete({ where: { citizenid: player.citizenid } })
            .catch(() => undefined);

        if (spawnPosition) {
            TriggerClientEvent(ClientEvent.PLAYER_BODY_TELEPORT, source, spawnPosition);
        }
    }

    private async spawnBody(snapshot: DisconnectedBodySnapshot, persist: boolean) {
        if (this.bodies[snapshot.citizenId]) {
            return;
        }

        const pedHandle = CreatePed(
            0,
            snapshot.model,
            snapshot.position[0],
            snapshot.position[1],
            snapshot.position[2],
            snapshot.position[3],
            true,
            true,
        );

        if (!pedHandle) {
            return;
        }

        const netId = NetworkGetNetworkIdFromEntity(pedHandle);
        this.bodies[snapshot.citizenId] = { netId };

        if (persist) {
            await this.persistBody(snapshot);
        }

        const owner = NetworkGetEntityOwner(pedHandle);
        TriggerClientEvent(ClientEvent.PLAYER_BODY_APPLY_APPEARANCE, owner, netId, snapshot);
    }

    private async persistBody(snapshot: DisconnectedBodySnapshot) {
        const data = {
            position: JSON.stringify(snapshot.position),
            model: String(snapshot.model),
            skin: JSON.stringify(snapshot.skin),
            outfit: JSON.stringify(snapshot.outfit),
            animation: snapshot.animation ? JSON.stringify(snapshot.animation) : null,
            is_dead: snapshot.isDead,
        };

        await this.prismaService.disconnected_body.upsert({
            where: { citizenid: snapshot.citizenId },
            create: { citizenid: snapshot.citizenId, ...data },
            update: data,
        });
    }
}
