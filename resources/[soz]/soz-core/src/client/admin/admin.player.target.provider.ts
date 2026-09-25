import { Once, OnceStep } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { AdminPlayerContextMenu, ContextMenuEntry } from '@public/config/context-menu';
import { AdminPlayer } from '@public/shared/admin/admin';
import { TargetOption } from '@public/shared/target';

import { Notifier } from '../notifier';
import { SenateRepository } from '../repository/senate.repository';
import { buildContextMenu } from '../target/context-menu';
import { TargetFactory } from '../target/target.factory';
import { TargetProvider } from '../target/target.provider';
import { AdminMenuPlayerProvider } from './admin.menu.player.provider';
import { AdminLevel, AdminPermissionService } from './admin.permission.service';
import { AdminSpectateProvider } from './admin.spectate.provider';

const DISEASES = [
    { label: 'Rhume', value: 'rhume' },
    { label: 'Grippe', value: 'grippe' },
    { label: 'Intoxication', value: 'intoxication' },
    { label: 'Rougeur', value: 'rougeur' },
    { label: 'Mal au dos', value: 'backpain' },
    { label: 'Soigner', value: false },
];

const EFFECTS = [
    { label: 'Alcoolique', value: 'alcohol' },
    { label: 'Drogué', value: 'drug' },
    { label: 'Normal', value: 'normal' },
];

const ATTRIBUTES: { label: string; attribute: 'strength' | 'stamina' | 'stress' | 'deficiency' | 'all' }[] = [
    { label: 'Force', attribute: 'strength' },
    { label: 'Endurance', attribute: 'stamina' },
    { label: 'Stress', attribute: 'stress' },
    { label: 'Carence', attribute: 'deficiency' },
    { label: 'Tous les attributs', attribute: 'all' },
];

// Nombre de blessures proposées par le menu admin (0 à 12)
const INJURIES_COUNT = 13;

// Pas de limite de portée: seule la portée du raycast de ciblage s'applique
const ADMIN_TARGET_DISTANCE = Infinity;

type AdminPlayerOption = { level: AdminLevel; onSelf: boolean; option: TargetOption };

/**
 * Menu contextuel admin quand on clique sur un joueur (ou sur soi-même): les mêmes actions et les mêmes règles de rôle
 * que le sous-menu joueur du menu admin (F1). La place, le nom et le rôle de chaque entrée sont dans
 * config/context-menu.ts (AdminPlayerContextMenu).
 */
@Provider()
export class AdminPlayerTargetProvider {
    @Inject(TargetFactory)
    private targetFactory: TargetFactory;

    @Inject(TargetProvider)
    private targetProvider: TargetProvider;

    @Inject(AdminPermissionService)
    private adminPermissionService: AdminPermissionService;

    @Inject(AdminMenuPlayerProvider)
    private adminMenuPlayerProvider: AdminMenuPlayerProvider;

    @Inject(AdminSpectateProvider)
    private adminSpectateProvider: AdminSpectateProvider;

    @Inject(SenateRepository)
    private senateRepository: SenateRepository;

    @Inject(Notifier)
    private notifier: Notifier;

    @Once(OnceStep.RepositoriesLoaded)
    public onRepositoriesLoaded(): void {
        const options = this.getOptions();

        this.targetFactory.createForAllPlayer(
            options.map(({ level, option }) => ({
                ...option,
                // Les outils admin restent disponibles pendant les événements (WhatIf, jeu du vampire...), qui
                // masquent les cibles sans événement
                event: 'all',
                canInteract: async () =>
                    this.targetProvider.isCursorMode() &&
                    this.adminPermissionService.hasLevel(await this.adminPermissionService.getPermission(), level),
            })),
            ADMIN_TARGET_DISTANCE
        );

        // Cliquer sur son propre personnage: les mêmes actions, sauf celles qui n'ont pas de sens sur soi
        this.targetProvider.registerSelfPedOptions(async () => {
            const permission = await this.adminPermissionService.getPermission();

            return options
                .filter(({ level, onSelf }) => onSelf && this.adminPermissionService.hasLevel(permission, level))
                .map(({ option }) => option);
        });
    }

    // Les actions du menu admin travaillent sur un AdminPlayer (id serveur, citizenId, nom...): on le retrouve à
    // partir du ped cliqué
    private forPlayer(action: (player: AdminPlayer) => unknown): TargetOption['action'] {
        return async (entity?: number) => {
            const serverId = entity ? GetPlayerServerId(NetworkGetPlayerIndexFromPed(entity)) : -1;
            const player = serverId > 0 ? await this.adminMenuPlayerProvider.findAdminPlayer(serverId) : null;

            if (!player) {
                this.notifier.notify('Joueur introuvable.', 'error');

                return;
            }

            await action(player);
        };
    }

    private getOptions(): AdminPlayerOption[] {
        const provider = this.adminMenuPlayerProvider;
        const list: AdminPlayerOption[] = [];

        // Ajoute une option à la suite: l'ordre de la liste est celui de la config
        const push = (entry: ContextMenuEntry, label: string, action: (player: AdminPlayer) => unknown) => {
            list.push({
                level: entry.level ?? 'any',
                onSelf: entry.onSelf ?? true,
                option: {
                    label,
                    group: entry.group,
                    icon: entry.icon,
                    category: 'citizen',
                    action: this.forPlayer(action),
                    order: String(list.length).padStart(3, '0'),
                },
            });
        };

        // Une action simple, nommée par la config
        const single = (action: (player: AdminPlayer) => unknown) => (entry: ContextMenuEntry) =>
            push(entry, entry.label ?? entry.id, action);

        const builders: Record<string, (entry: ContextMenuEntry) => void> = {
            spectate: single(player => this.adminSpectateProvider.spectate(player)),
            goto: single(player => provider.handleTeleportOption({ action: 'goto', player })),
            bring: single(player => provider.handleTeleportOption({ action: 'bring', player })),
            revive: single(player => provider.handleHealthOption({ action: 'revive', player })),
            kill: single(player => provider.handleHealthOption({ action: 'kill', player })),
            freeze: single(player => provider.handleMovementOption({ action: 'freeze', player })),
            unfreeze: single(player => provider.handleMovementOption({ action: 'unfreeze', player })),
            mute: single(player => provider.handleVocalOption({ action: 'mute', player })),
            unmute: single(player => provider.handleVocalOption({ action: 'unmute', player })),
            search: single(player => provider.handleResetPlayerSearch(player)),

            // Blocs générés: le sous-menu vient de la config, le nom de chaque option d'ici
            diseases: entry => {
                for (const disease of DISEASES) {
                    push(entry, disease.label, player =>
                        provider.handleDiseaseOption({ action: disease.value as string, player })
                    );
                }
            },
            effects: entry => {
                for (const effect of EFFECTS) {
                    push(entry, effect.label, player =>
                        provider.handleEffectsOption({ action: effect.value, player })
                    );
                }
            },
            injuries: entry => {
                for (let value = 0; value < INJURIES_COUNT; value++) {
                    push(entry, String(value), player => provider.updateInjuriesCount({ player, value }));
                }
            },
            attributes: entry => {
                for (const { label, attribute } of ATTRIBUTES) {
                    for (const value of ['min', 'max'] as const) {
                        push(entry, `${label} ${value}`, player =>
                            provider.handleSetAttribute({ player, attribute, value })
                        );
                    }
                }
            },
            parties: entry => {
                push(entry, 'Aucun', player => provider.handlePlayerSetSenateParty({ player, value: null }));

                for (const party of Object.values(this.senateRepository.get())) {
                    push(entry, party.name, player =>
                        provider.handlePlayerSetSenateParty({ player, value: party.id })
                    );
                }
            },

            voiceStatus: single(player => provider.handleVocalOption({ action: 'status', player })),
            voiceDebugOn: single(player => provider.setPlayerDebug({ player, value: true })),
            voiceDebugOff: single(player => provider.setPlayerDebug({ player, value: false })),

            resetSkin: single(player => provider.handleResetSkin(player)),
            reputation: single(player => provider.handleGiveReputation(player)),
            resetCrimi: single(player => provider.handleResetCrimi(player)),
            resetClientState: single(player => provider.handleResetClientState(player)),
            missiveOn: single(player => provider.handleSetCanCraftMissive({ player, value: true })),
            missiveOff: single(player => provider.handleSetCanCraftMissive({ player, value: false })),
        };

        buildContextMenu('admin joueur', AdminPlayerContextMenu, builders);

        return list;
    }
}
