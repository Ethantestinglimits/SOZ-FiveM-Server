import { On, Once, OnceStep, OnEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { wait } from '../../core/utils';
import { ClientEvent, ServerEvent } from '../../shared/event';
import { PlayerData } from '../../shared/player';
import { DisconnectedBodySnapshot } from '../../shared/player-disconnected-body';
import { Vector4 } from '../../shared/polyzone/vector';
import { PrismaService } from '../database/prisma.service';

type TrackedBody = {
    netId: number;
    snapshot: DisconnectedBodySnapshot;
};

@Provider()
export class PlayerDisconnectedBodyProvider {
    @Inject(PrismaService)
    private prismaService: PrismaService;

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

    @OnEvent(ServerEvent.PLAYER_BODY_MOVED)
    public onBodyMoved(source: number, netId: number, position: Vector4) {
        const tracked = Object.values(this.bodies).find(body => body.netId === netId);
        if (!tracked) {
            return;
        }

        tracked.snapshot = { ...tracked.snapshot, position };
        this.persistBody(tracked.snapshot).catch(() => undefined);
    }

    @On('playerDropped')
    public async onPlayerDropped(source: number) {
        const snapshot = this.lastKnownState[source];
        delete this.lastKnownState[source];

        if (!snapshot) {
            return;
        }

        await this.spawnBody(snapshot, true);
    }

    @OnEvent(ServerEvent.PLAYER_LOADED, false)
    public async onPlayerLoaded(source: number, player: PlayerData) {
        // Resync every currently active body to this newly (re)connected client: targets/mood/appearance
        // are applied locally by each client (they are not part of FiveM's entity sync), so anyone who
        // wasn't online when a body was originally spawned/broadcast needs a catch-up send, not just the
        // player reconnecting onto their own body.
        for (const citizenId of Object.keys(this.bodies)) {
            if (citizenId === player.citizenid) {
                continue;
            }

            const tracked = this.bodies[citizenId];
            TriggerClientEvent(ClientEvent.PLAYER_BODY_APPLY_APPEARANCE, source, tracked.netId, tracked.snapshot);
        }

        const body = this.bodies[player.citizenid];
        if (!body) {
            return;
        }

        delete this.bodies[player.citizenid];

        // The body's own tracked snapshot position is the source of truth: it starts as the disconnect
        // spot and is kept current by PLAYER_BODY_MOVED whenever someone carries the body. It is not
        // read off the live entity here because a just-frozen entity's synced position can briefly lag
        // behind on the server.
        const spawnPosition: Vector4 = body.snapshot.position;
        let entity = NetworkGetEntityFromNetworkId(body.netId);
        let attempts = 0;
        while ((!entity || !DoesEntityExist(entity)) && attempts < 20) {
            await wait(100);
            entity = NetworkGetEntityFromNetworkId(body.netId);
            attempts++;
        }

        if (entity && DoesEntityExist(entity)) {
            DeleteEntity(entity);
        } else {
            console.warn(
                `[disconnected-body] could not resolve body entity (netId ${body.netId}) for citizenid ${player.citizenid} on reconnect, it may remain in the world`
            );
        }

        TriggerClientEvent(ClientEvent.PLAYER_BODY_REMOVE, -1, body.netId);

        await this.prismaService.disconnected_body
            .delete({ where: { citizenid: player.citizenid } })
            .catch(() => undefined);

        TriggerClientEvent(ClientEvent.PLAYER_BODY_TELEPORT, source, spawnPosition);
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

        // Same as world.event.provider.ts's server-spawned peds: without this, the entity can be torn
        // down when whichever client currently owns it (e.g. the last player to carry the body) leaves
        // or loses relevance, silently invalidating netId — reconnect then can't resolve the entity to
        // read its current position and falls back to the player's last saved (pre-disconnect) spot.
        SetEntityOrphanMode(pedHandle, 2);

        // A freshly created ped with no task runs the game's default ambient AI (wanders, reacts like
        // a civilian) until a client applies the real config. Freezing it immediately stops the
        // wandering; SetBlockingOfNonTemporaryEvents is a client-only native (calling it here would
        // throw and abort spawnBody before the appearance broadcast even fires), so that part stays in
        // configurePed on the client that takes ownership.
        try {
            FreezeEntityPosition(pedHandle, true);
            SetEntityInvincible(pedHandle, true);
            // Disabled until the owning client re-enables it once fully dressed/positioned, so a
            // vehicle passing through the spawn spot (or the ped landing slightly inside one) can't
            // shove/collide with it during the brief default-appearance window.
            SetEntityCollision(pedHandle, false, false);
            // Hidden until the owning client reveals it once dressed, so nobody catches the model's
            // default clothes while it streams in ahead of that.
            SetEntityVisible(pedHandle, false, false);
        } catch (error) {
            console.warn(`[disconnected-body] failed to lock down spawned ped behavior: ${error}`);
        }

        const netId = NetworkGetNetworkIdFromEntity(pedHandle);
        this.bodies[snapshot.citizenId] = { netId, snapshot };

        if (persist) {
            await this.persistBody(snapshot);
        }

        // Broadcast to everyone, not just NetworkGetEntityOwner: targets and the facial mood override are
        // local-only client state, not part of FiveM's entity sync, so every client needs to run this itself.
        TriggerClientEvent(ClientEvent.PLAYER_BODY_APPLY_APPEARANCE, -1, netId, snapshot);
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
