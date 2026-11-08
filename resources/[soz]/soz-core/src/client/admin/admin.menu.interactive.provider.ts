import { OnNuiEvent } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { emitRpc } from '../../core/rpc';
import { slugify } from '../../nui/utils/slugify';
import { AdminPlayer, LightAdminPlayer } from '../../shared/admin/admin';
import { ClientEvent, NuiEvent, ServerEvent } from '../../shared/event';
import { FDO, JobType } from '../../shared/job';
import { MinimapPlayerGroup, PlayersLayerLayout, PlayersLayerState } from '../../shared/nui/minimap';
import { Vector3 } from '../../shared/polyzone/vector';
import { RpcServerEvent } from '../../shared/rpc';
import { BlipFactory } from '../blip';
import { DrawService } from '../draw.service';
import { AdminSpectateProvider } from './admin.spectate.provider';

export const PLAYER_BLIP_PREFIX = 'admin:player-blip:';
const PLAYERS_LAYOUT_KVP = 'soz_pause_map_players';
const PLAYERS_LAYER_ROLES = ['staff', 'admin', 'gamemaster'];
const MAP_ADMIN_CACHE = 30000;

export type PlayerBlipGroup = MinimapPlayerGroup & { color: number };

export type PlayerBlipGroupResolver = (player: LightAdminPlayer) => PlayerBlipGroup | undefined;

const FDO_GROUP: PlayerBlipGroup = { id: 'fdo', label: 'FDO', order: 10, color: 3 };
const RESCUE_GROUP: PlayerBlipGroup = { id: 'rescue', label: 'Secours', order: 20, color: 1 };
const CIVIL_GROUP: PlayerBlipGroup = { id: 'civil', label: 'Civil', order: 30, color: 0 };

const getBaseGroup = (player: LightAdminPlayer): PlayerBlipGroup => {
    if (FDO.includes(player.job)) {
        return FDO_GROUP;
    }

    return player.job === JobType.LSMC ? RESCUE_GROUP : CIVIL_GROUP;
};

@Provider()
export class AdminMenuInteractiveProvider {
    @Inject(DrawService)
    private drawService: DrawService;

    @Inject(BlipFactory)
    private blipFactory: BlipFactory;

    @Inject(AdminSpectateProvider)
    private adminSpectateProvider: AdminSpectateProvider;

    private playerBlipGroup: PlayerBlipGroupResolver = () => undefined;

    private playerGroups = new Map<string, MinimapPlayerGroup>();

    private mapAdmin: { allowed: boolean; checkedAt: number } | null = null;

    public setPlayerBlipGroupResolver(resolver: PlayerBlipGroupResolver): void {
        this.playerBlipGroup = resolver;
    }

    public getPlayerGroup(blipId: string): MinimapPlayerGroup | undefined {
        return this.playerGroups.get(blipId);
    }

    public intervalHandlers = {
        displayOwners: null,
        displayPlayerNames: null,
        displayPlayersOnMap: null,
    };

    private multiplayerTags: Map<string, number> = new Map();
    private playerBlips: Map<string, number> = new Map();

    @OnNuiEvent(NuiEvent.AdminToggleDisplayOwners)
    public async toggleDisplayOwners(value: boolean): Promise<void> {
        if (!value) {
            clearInterval(this.intervalHandlers.displayOwners);
            this.intervalHandlers.displayOwners = null;
            return;
        }
        this.intervalHandlers.displayOwners = setInterval(async () => {
            const vehicles: number[] = GetGamePool('CVehicle');
            const playerCoords = GetEntityCoords(PlayerPedId(), false);
            for (const vehicle of vehicles) {
                const vehicleCoords = GetEntityCoords(vehicle, false);
                const dist = GetDistanceBetweenCoords(
                    vehicleCoords[0],
                    vehicleCoords[1],
                    vehicleCoords[2],
                    playerCoords[0],
                    playerCoords[1],
                    playerCoords[2],
                    false
                );

                if (dist < 50) {
                    let text = ' | OwnerNet: ';
                    if (GetPlayerServerId(NetworkGetEntityOwner(vehicle)) === GetPlayerServerId(PlayerId())) {
                        text = ` | ~g~OwnerNet: `;
                    }
                    const ownerInfo =
                        `${GetDisplayNameFromVehicleModel(GetEntityModel(vehicle))} ` +
                        `| VehicleNet: ${NetworkGetNetworkIdFromEntity(vehicle)} ` +
                        `${text} ${GetPlayerServerId(NetworkGetEntityOwner(vehicle))}`;
                    const vehicleInfo =
                        `Veh Engine.: ${GetVehicleEngineHealth(vehicle).toFixed(2)} ` +
                        `| Veh Body: ${GetVehicleBodyHealth(vehicle).toFixed(2)}` +
                        `| Veh Tank: ${GetVehiclePetrolTankHealth(vehicle).toFixed(2)}` +
                        `| Veh Oil: ${GetVehicleOilLevel(vehicle).toFixed(2)}/${GetVehicleHandlingFloat(
                            vehicle,
                            'CHandlingData',
                            'fOilVolume'
                        ).toFixed(2)}`;
                    this.drawService.drawText3d([vehicleCoords[0], vehicleCoords[1], vehicleCoords[2] + 1], ownerInfo);
                    this.drawService.drawText3d(
                        [vehicleCoords[0], vehicleCoords[1], vehicleCoords[2] + 2],
                        vehicleInfo
                    );
                }
            }

            const peds: number[] = GetGamePool('CPed');
            for (const ped of peds) {
                if (IsPedInAnyVehicle(ped, false) || !NetworkGetEntityIsNetworked(ped)) {
                    continue;
                }
                const pedCoords = GetEntityCoords(ped, false);
                const dist = GetDistanceBetweenCoords(
                    pedCoords[0],
                    pedCoords[1],
                    pedCoords[2],
                    playerCoords[0],
                    playerCoords[1],
                    playerCoords[2],
                    false
                );
                if (dist < 50) {
                    let text = ' | OwnerNet: ';
                    if (GetPlayerServerId(NetworkGetEntityOwner(ped)) === GetPlayerServerId(PlayerId())) {
                        text = ` | ~g~OwnerNet: `;
                    }
                    const ownerInfo =
                        `PedNet: ${NetworkGetNetworkIdFromEntity(ped)} ` +
                        `${text} ${GetPlayerServerId(NetworkGetEntityOwner(ped))}`;
                    this.drawService.drawText3d([pedCoords[0], pedCoords[1], pedCoords[2] + 1], ownerInfo);
                }
            }

            const objects: number[] = GetGamePool('CObject');
            for (const object of objects) {
                if (!NetworkGetEntityIsNetworked(object)) {
                    continue;
                }
                const objectCoords = GetEntityCoords(object, false);
                const dist = GetDistanceBetweenCoords(
                    objectCoords[0],
                    objectCoords[1],
                    objectCoords[2],
                    playerCoords[0],
                    playerCoords[1],
                    playerCoords[2],
                    false
                );
                if (dist < 50) {
                    let text = ' | OwnerNet: ';
                    if (GetPlayerServerId(NetworkGetEntityOwner(object)) === GetPlayerServerId(PlayerId())) {
                        text = ` | ~g~OwnerNet: `;
                    }
                    const ownerInfo =
                        `ObjNet: ${NetworkGetNetworkIdFromEntity(object)} ` +
                        `${text} ${GetPlayerServerId(NetworkGetEntityOwner(object))}`;
                    this.drawService.drawText3d([objectCoords[0], objectCoords[1], objectCoords[2] + 1], ownerInfo);
                }
            }
        }, 1);
    }

    @OnNuiEvent(NuiEvent.AdminToggleDisplayPlayerNames)
    public async toggleDisplayPlayerNames({
        value,
        withDetails,
    }: {
        value: boolean;
        withDetails: boolean;
    }): Promise<void> {
        if (!value) {
            for (const value of this.multiplayerTags.values()) {
                SetMpGamerTagVisibility(value, 0, false);
                SetMpGamerTagVisibility(value, 2, false);
                RemoveMpGamerTag(value);
            }
            clearInterval(this.intervalHandlers.displayPlayerNames);
            this.intervalHandlers.displayPlayerNames = null;
            return;
        }
        await this.displayPlayerNames(withDetails);
        this.intervalHandlers.displayPlayerNames = setInterval(async () => {
            await this.displayPlayerNames(withDetails);
        }, 5000);
    }

    @OnNuiEvent(NuiEvent.AdminToggleDisplayPlayersOnMap)
    public async toggleDisplayPlayersOnMap(value: boolean): Promise<void> {
        if (value === (this.intervalHandlers.displayPlayersOnMap !== null)) {
            return;
        }

        if (!value) {
            this.playerBlips.forEach((BlipValue, BlipKey) => {
                this.blipFactory.remove(PLAYER_BLIP_PREFIX + BlipKey);
                this.playerBlips.delete(BlipKey);
                this.playerGroups.delete(PLAYER_BLIP_PREFIX + BlipKey);
            });

            clearInterval(this.intervalHandlers.displayPlayersOnMap);
            this.intervalHandlers.displayPlayersOnMap = null;
            return;
        }

        this.intervalHandlers.displayPlayersOnMap = setInterval(async () => {
            const players = await emitRpc<LightAdminPlayer[]>(RpcServerEvent.ADMIN_GET_LIGHT_PLAYERS);

            this.playerBlips.forEach((BlipValue, BlipKey) => {
                if (!players.some(player => player.citizenId === BlipKey)) {
                    this.blipFactory.remove(PLAYER_BLIP_PREFIX + BlipKey);
                    this.playerBlips.delete(BlipKey);
                    this.playerGroups.delete(PLAYER_BLIP_PREFIX + BlipKey);
                }
            });

            for (const player of players) {
                const coords = player.coords;
                const blipId = PLAYER_BLIP_PREFIX + player.citizenId;
                const { color, ...group } = this.playerBlipGroup(player) ?? getBaseGroup(player);

                this.playerGroups.set(blipId, group);

                if (this.blipFactory.exist(blipId)) {
                    this.blipFactory.update(PLAYER_BLIP_PREFIX + player.citizenId, {
                        position: coords as Vector3,
                        heading: player.heading,
                        color,
                    });
                } else {
                    const createdBlip = this.blipFactory.create(
                        PLAYER_BLIP_PREFIX + player.citizenId,
                        {
                            position: coords as Vector3,
                            heading: player.heading,
                            name: player.rpFullName,
                            playerId: player.id,
                            showHeading: true,
                            sprite: 1,
                            color,
                            category: 7,
                            group: 'admin',
                        },
                        [
                            {
                                label: 'Aller vers le joueur',
                                action: () =>
                                    TriggerServerEvent(ServerEvent.ADMIN_TELEPORT_TO_PLAYER, { id: player.id }),
                            },
                            {
                                label: 'Suivre le joueur',
                                action: () => this.adminSpectateProvider.spectate({ id: player.id } as AdminPlayer),
                            },
                            {
                                label: 'Ouvrir sa fiche',
                                action: () => {
                                    TriggerEvent(ClientEvent.PAUSE_MENU_CLOSE);
                                    TriggerEvent(ClientEvent.ADMIN_OPEN_MENU, slugify('player_' + player.citizenId));
                                },
                            },
                        ]
                    );

                    this.playerBlips.set(player.citizenId, createdBlip);
                }
            }
        }, 2500);
    }

    public async isMapAdmin(): Promise<boolean> {
        if (this.mapAdmin && GetGameTimer() - this.mapAdmin.checkedAt < MAP_ADMIN_CACHE) {
            return this.mapAdmin.allowed;
        }

        const [isAllowed, permission] = await emitRpc<[boolean, string]>(RpcServerEvent.ADMIN_IS_ALLOWED);

        this.mapAdmin = { allowed: isAllowed && PLAYERS_LAYER_ROLES.includes(permission), checkedAt: GetGameTimer() };

        return this.mapAdmin.allowed;
    }

    @OnNuiEvent(NuiEvent.PauseMenuPlayersLayer)
    public async getPlayersLayer(): Promise<PlayersLayerState> {
        return {
            allowed: await this.isMapAdmin(),
            enabled: this.intervalHandlers.displayPlayersOnMap !== null,
            layout: this.getPlayersLayout(),
        };
    }

    @OnNuiEvent(NuiEvent.PauseMenuSavePlayersLayout)
    public async savePlayersLayout(layout: PlayersLayerLayout): Promise<void> {
        SetResourceKvp(PLAYERS_LAYOUT_KVP, JSON.stringify(layout));
    }

    private getPlayersLayout(): PlayersLayerLayout {
        try {
            const saved = JSON.parse(GetResourceKvpString(PLAYERS_LAYOUT_KVP) ?? 'null');

            return {
                collapsed: Boolean(saved?.collapsed),
                expanded: Array.isArray(saved?.expanded) ? saved.expanded : [],
            };
        } catch {
            return { collapsed: false, expanded: [] };
        }
    }

    private async displayPlayerNames(withDetails: boolean): Promise<void> {
        for (const value of Object.values(this.multiplayerTags)) {
            RemoveMpGamerTag(value);
            this.multiplayerTags.delete(value);
        }

        const players = await emitRpc<AdminPlayer[]>(RpcServerEvent.ADMIN_GET_PLAYERS);
        const playerId = PlayerId();

        players.forEach(player => {
            if (player.id == GetPlayerServerId(playerId)) {
                return;
            }

            const localPlayerPed = GetPlayerFromServerId(player.id);
            this.multiplayerTags.set(player.citizenId, localPlayerPed);

            let name = player.rpFullName;
            if (withDetails) {
                name += ` | ${player.name} | ${player.id} | plaques: ${player.armorPlates}`;
            }
            CreateMpGamerTagWithCrewColor(localPlayerPed, name, false, false, '', 0, 0, 0, 0);
            if (withDetails) {
                SetMpGamerTagName(localPlayerPed, name); // Force update for plates
            }
            SetMpGamerTagVisibility(localPlayerPed, 0, true);

            if (withDetails) {
                SetMpGamerTagVisibility(localPlayerPed, 2, true);
                SetMpGamerTagAlpha(localPlayerPed, 2, 255);
            } else {
                SetMpGamerTagVisibility(localPlayerPed, 2, false);
            }
        });
    }
}
