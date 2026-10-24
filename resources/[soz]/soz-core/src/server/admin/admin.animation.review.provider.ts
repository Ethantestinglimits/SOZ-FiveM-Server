import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Rpc } from '../../core/decorators/rpc';
import { Logger } from '../../core/logger';
import {
    AnimationReviewDecision,
    AnimationReviewDecisions,
    AnimationReviewPack,
    AnimationReviewPackSummary,
} from '../../shared/animation';
import { RpcServerEvent } from '../../shared/rpc';
import { PermissionService } from '../permission.service';

const REVIEW_DIR = 'data/animation-review';

type PackIndexEntry = {
    id: string;
    title: string;
    count: number;
};

@Provider()
export class AdminAnimationReviewProvider {
    @Inject(PermissionService)
    private permissionService: PermissionService;

    @Inject(Logger)
    private logger: Logger;

    private readJson<T>(file: string): T | null {
        const content = LoadResourceFile(GetCurrentResourceName(), `${REVIEW_DIR}/${file}`);

        if (!content) {
            return null;
        }

        try {
            return JSON.parse(content) as T;
        } catch (e) {
            this.logger.error(`[animation-review] invalid json in ${file}`, e);

            return null;
        }
    }

    private getIndex(): PackIndexEntry[] {
        return this.readJson<PackIndexEntry[]>('index.json') || [];
    }

    private isValidPack(packId: string): boolean {
        return this.getIndex().some(pack => pack.id === packId);
    }

    private getDecisions(packId: string): AnimationReviewDecisions {
        return this.readJson<AnimationReviewDecisions>(`${packId}.decisions.json`) || {};
    }

    @Rpc(RpcServerEvent.ADMIN_ANIMATION_REVIEW_LIST)
    public listPacks(source: number): AnimationReviewPackSummary[] {
        if (!this.permissionService.isStaff(source)) {
            return [];
        }

        return this.getIndex().map(pack => {
            const decisions = Object.values(this.getDecisions(pack.id));

            return {
                ...pack,
                decided: decisions.length,
                kept: decisions.filter(verdict => verdict.decision === 'keep').length,
            };
        });
    }

    @Rpc(RpcServerEvent.ADMIN_ANIMATION_REVIEW_GET_PACK)
    public getPack(
        source: number,
        packId: string
    ): { pack: AnimationReviewPack; decisions: AnimationReviewDecisions } | null {
        if (!this.permissionService.isStaff(source) || !this.isValidPack(packId)) {
            return null;
        }

        const pack = this.readJson<AnimationReviewPack>(`packs/${packId}.json`);

        if (!pack) {
            return null;
        }

        return { pack, decisions: this.getDecisions(packId) };
    }

    @Rpc(RpcServerEvent.ADMIN_ANIMATION_REVIEW_DECIDE)
    public decide(
        source: number,
        packId: string,
        key: string,
        decision: AnimationReviewDecision | null,
        note?: string
    ): boolean {
        if (!this.permissionService.isStaff(source) || !this.isValidPack(packId)) {
            return false;
        }

        const decisions = this.getDecisions(packId);
        const previous = decisions[key];

        if (decision === null) {
            delete decisions[key];
        } else {
            decisions[key] = { decision, note: note ?? previous?.note };

            if (!decisions[key].note) {
                delete decisions[key].note;
            }
        }

        return SaveResourceFile(
            GetCurrentResourceName(),
            `${REVIEW_DIR}/${packId}.decisions.json`,
            JSON.stringify(decisions, null, 4) + '\n',
            -1
        );
    }
}
