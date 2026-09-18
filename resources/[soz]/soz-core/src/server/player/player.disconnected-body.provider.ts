import { On, Once, OnceStep, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { PlayerData } from '../../shared/player';
import { DisconnectedBodySnapshot } from '../../shared/player-disconnected-body';
import { Vector4 } from '../../shared/polyzone/vector';
import { PrismaService } from '../database/prisma.service';

// Resting bodies are NOT server-side entities: every client spawns its own local, non-networked ped
// clone once it is close enough (see the client provider's distance loop), so there is never a single
// networked entity whose ownership/control/sync state to fight over for the common case. A real
// networked ped only exists for the few seconds someone is actively carrying one (see the carry* handlers).
@Provider()
export class PlayerDisconnectedBodyProvider {
    @Inject(PrismaService)
    private prismaService: PrismaService;

    private lastKnownState: Record<number, DisconnectedBodySnapshot> = {};

    private bodies: Record<string, DisconnectedBodySnapshot> = {};

    private carriedNetIds: Record<string, number> = {};

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

            this.bodies[snapshot.citizenId] = snapshot;
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

        if (!snapshot || this.bodies[snapshot.citizenId]) {
            return;
        }

        this.bodies[snapshot.citizenId] = snapshot;
        await this.persistBody(snapshot);

        TriggerClientEvent(ClientEvent.PLAYER_BODY_SYNC, -1, snapshot);
    }

    @OnEvent(ServerEvent.PLAYER_LOADED, false)
    public async onPlayerLoaded(source: number, player: PlayerData) {
        // Every client keeps its own local list of resting bodies (used to spawn/despawn local clones
        // by distance), so a newly (re)connected client needs the full current list up front.
        TriggerClientEvent(ClientEvent.PLAYER_BODY_SYNC_ALL, source, Object.values(this.bodies));

        const body = this.bodies[player.citizenid];
        if (!body) {
            return;
        }

        delete this.bodies[player.citizenid];

        TriggerClientEvent(ClientEvent.PLAYER_BODY_REMOVE, -1, player.citizenid);

        await this.prismaService.disconnected_body
            .delete({ where: { citizenid: player.citizenid } })
            .catch(() => undefined);

        TriggerClientEvent(ClientEvent.PLAYER_BODY_TELEPORT, source, body.position);
    }

    @OnEvent(ServerEvent.PLAYER_BODY_START_CARRY)
    public onStartCarry(source: number, citizenId: string, netId: number) {
        if (!this.bodies[citizenId] || this.carriedNetIds[citizenId]) {
            return;
        }

        this.carriedNetIds[citizenId] = netId;

        // Everyone still tracking a local clone for this body needs to drop it now that a real
        // networked ped (the one being carried) represents it instead.
        TriggerClientEvent(ClientEvent.PLAYER_BODY_CARRY_STATE, -1, citizenId, true);
    }

    @OnEvent(ServerEvent.PLAYER_BODY_STOP_CARRY)
    public async onStopCarry(source: number, citizenId: string, position: Vector4) {
        if (!this.bodies[citizenId]) {
            return;
        }

        delete this.carriedNetIds[citizenId];

        const snapshot: DisconnectedBodySnapshot = { ...this.bodies[citizenId], position };
        this.bodies[citizenId] = snapshot;
        await this.persistBody(snapshot);

        // Resume normal local-clone rendering for everyone at the new position.
        TriggerClientEvent(ClientEvent.PLAYER_BODY_SYNC, -1, snapshot);
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
