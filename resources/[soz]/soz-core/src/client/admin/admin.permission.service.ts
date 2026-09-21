import { Injectable } from '@core/decorators/injectable';
import { emitRpc } from '@core/rpc';
import { RpcServerEvent } from '@public/shared/rpc';
import { ContextMenuLevel } from '@public/shared/target';

export type AdminLevel = ContextMenuLevel;

// La permission ne change pas en cours de session: on évite de la redemander au serveur à chaque affichage de menu
const ADMIN_PERMISSION_TTL = 60 * 1000;

@Injectable()
export class AdminPermissionService {
    private cache: { value: string | null; until: number } | null = null;

    /** Rôle du joueur s'il a accès aux outils admin ('helper', 'gamemaster', 'staff', 'admin'), sinon null */
    public async getPermission(): Promise<string | null> {
        if (this.cache && this.cache.until >= GetGameTimer()) {
            return this.cache.value;
        }

        let value: string | null = null;

        try {
            const [isAllowed, permission] = await emitRpc<[boolean, string]>(RpcServerEvent.ADMIN_IS_ALLOWED);
            value = isAllowed ? permission : null;
        } catch (error) {
            console.error('[admin] permission admin indisponible', error);
        }

        this.cache = { value, until: GetGameTimer() + ADMIN_PERMISSION_TTL };

        return value;
    }

    public hasLevel(permission: string | null, level: AdminLevel): boolean {
        if (!permission) return false;
        if (level === 'admin') return permission === 'admin';
        if (level === 'staff') return permission === 'admin' || permission === 'staff';
        if (level === 'gamemaster') return ['admin', 'staff', 'gamemaster'].includes(permission);

        return true;
    }
}
