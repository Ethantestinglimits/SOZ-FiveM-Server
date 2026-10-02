import { Animations } from '../../config/animation';
import { Once, OnceStep } from '../../core/decorators/event';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Rpc } from '../../core/decorators/rpc';
import {
    AnimationConfigItem,
    PROP_ANIMATION_LABEL_MAX_LENGTH,
    PROP_ANIMATION_MAX_OFFSET,
    PROP_ANIMATION_MAX_PER_MODEL,
    PROP_ANIMATION_MAX_PER_PLAYER,
    PropAnimation,
    PropAnimationItem,
} from '../../shared/animation';
import { ClientEvent } from '../../shared/event';
import { Vector4 } from '../../shared/polyzone/vector';
import { RpcServerEvent } from '../../shared/rpc';
import { PrismaService } from '../database/prisma.service';
import { PermissionService } from '../permission.service';
import { PlayerService } from '../player/player.service';

type SaveResult = { ok: true } | { ok: false; error: string };

@Provider()
export class PropAnimationProvider {
    @Inject(PrismaService)
    private prismaService: PrismaService;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(PermissionService)
    private permissionService: PermissionService;

    private animations = new Map<number, PropAnimation>();

    @Once(OnceStep.DatabaseConnected)
    public async loadAnimations(): Promise<void> {
        const rows = await this.prismaService.prop_animation.findMany();

        for (const row of rows) {
            try {
                this.animations.set(row.id, {
                    id: row.id,
                    model: row.model,
                    label: row.label,
                    animation: JSON.parse(row.animation),
                    offset: JSON.parse(row.offset),
                    citizenId: row.citizen_id,
                    creatorName: row.creator_name,
                });
            } catch (error) {
                console.error(`[prop-animation] animation ${row.id} illisible, ignorée`, error);
            }
        }
    }

    @Rpc(RpcServerEvent.PROP_ANIMATION_GET_ALL)
    public getAll(): PropAnimation[] {
        return [...this.animations.values()];
    }

    @Rpc(RpcServerEvent.PROP_ANIMATION_SAVE)
    public async save(
        source: number,
        model: number,
        label: string,
        animationItem: PropAnimationItem,
        offset: Vector4
    ): Promise<SaveResult> {
        const player = this.playerService.getPlayer(source);
        if (!player) {
            return { ok: false, error: 'Joueur introuvable.' };
        }

        const name = typeof label === 'string' ? label.trim() : '';
        if (!name || name.length > PROP_ANIMATION_LABEL_MAX_LENGTH) {
            return { ok: false, error: 'Nom invalide.' };
        }

        if (!Number.isInteger(model)) {
            return { ok: false, error: 'Prop invalide.' };
        }

        if (
            !Array.isArray(offset) ||
            offset.length !== 4 ||
            !offset.every(value => typeof value === 'number' && Number.isFinite(value)) ||
            Math.hypot(offset[0], offset[1], offset[2]) > PROP_ANIMATION_MAX_OFFSET
        ) {
            return { ok: false, error: 'Vous êtes trop loin du prop.' };
        }

        // Seules les animations du menu sont acceptées, et on stocke la version de la config (pas celle envoyée)
        const animation = this.findMenuAnimation(animationItem);
        if (!animation) {
            return { ok: false, error: 'Cette animation ne peut pas être enregistrée.' };
        }

        const all = [...this.animations.values()];

        if (all.filter(entry => entry.model === model).length >= PROP_ANIMATION_MAX_PER_MODEL) {
            return {
                ok: false,
                error: `Ce prop a déjà ${PROP_ANIMATION_MAX_PER_MODEL} animations enregistrées.`,
            };
        }

        if (all.filter(entry => entry.citizenId === player.citizenid).length >= PROP_ANIMATION_MAX_PER_PLAYER) {
            return {
                ok: false,
                error: `Vous avez déjà enregistré ${PROP_ANIMATION_MAX_PER_PLAYER} animations, supprimez-en une d'abord.`,
            };
        }

        const creatorName = `${player.charinfo.firstname} ${player.charinfo.lastname}`.slice(0, 64);
        const rounded = offset.map(value => Math.round(value * 1000) / 1000) as Vector4;

        const row = await this.prismaService.prop_animation.create({
            data: {
                model,
                label: name,
                animation: JSON.stringify(animation),
                offset: JSON.stringify(rounded),
                citizen_id: player.citizenid,
                creator_name: creatorName,
            },
        });

        const saved: PropAnimation = {
            id: row.id,
            model,
            label: name,
            animation,
            offset: rounded,
            citizenId: player.citizenid,
            creatorName,
        };

        this.animations.set(saved.id, saved);
        TriggerClientEvent(ClientEvent.PROP_ANIMATION_ADDED, -1, saved);

        return { ok: true };
    }

    @Rpc(RpcServerEvent.PROP_ANIMATION_DELETE)
    public async delete(source: number, id: number): Promise<boolean> {
        const animation = this.animations.get(id);
        const player = this.playerService.getPlayer(source);

        if (!animation || !player) {
            return false;
        }

        if (animation.citizenId !== player.citizenid && !this.permissionService.isHelper(source)) {
            return false;
        }

        await this.prismaService.prop_animation.delete({ where: { id } });

        this.animations.delete(id);
        TriggerClientEvent(ClientEvent.PROP_ANIMATION_DELETED, -1, id);

        return true;
    }

    private findMenuAnimation(item: PropAnimationItem): PropAnimationItem | null {
        if (!item || (item.type !== 'animation' && item.type !== 'scenario')) {
            return null;
        }

        const expected = JSON.stringify(item.type === 'animation' ? item.animation : item.scenario);

        const search = (items: AnimationConfigItem[]): PropAnimationItem | null => {
            for (const entry of items) {
                if (entry.type === 'category') {
                    const found = search(entry.items);

                    if (found) {
                        return found;
                    }
                } else if (entry.type === 'animation' && item.type === 'animation') {
                    if (JSON.stringify(entry.animation) === expected) {
                        return entry;
                    }
                } else if (entry.type === 'scenario' && item.type === 'scenario') {
                    if (JSON.stringify(entry.scenario) === expected) {
                        return entry;
                    }
                }
            }

            return null;
        };

        return search(Animations);
    }
}
