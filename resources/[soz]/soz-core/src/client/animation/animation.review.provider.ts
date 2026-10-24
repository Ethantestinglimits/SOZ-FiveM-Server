import { Command } from '../../core/decorators/command';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick } from '../../core/decorators/tick';
import { emitRpc } from '../../core/rpc';
import { wait } from '../../core/utils';
import {
    AnimationReviewDecision,
    AnimationReviewDecisions,
    AnimationReviewEntry,
    AnimationReviewItem,
    AnimationReviewPack,
    AnimationReviewPackSummary,
} from '../../shared/animation';
import { Font } from '../../shared/hud';
import { Control } from '../../shared/input';
import { RpcServerEvent } from '../../shared/rpc';
import { DrawService } from '../draw.service';
import { Notifier } from '../notifier';
import { PlayerAnimationProvider } from '../player/player.animation.provider';
import { PlayerService } from '../player/player.service';
import { PlayerWalkstyleProvider } from '../player/player.walkstyle.provider';
import { AnimationService } from './animation.service';

type ReviewState = {
    pack: AnimationReviewPack;
    decisions: AnimationReviewDecisions;
    index: number;
};

const REVIEW_CONTROLS = [
    Control.PhoneUp,
    Control.PhoneDown,
    Control.PhoneLeft,
    Control.PhoneRight,
    Control.PhoneCancel,
    Control.FrontendRDown,
];

@Provider()
export class AnimationReviewProvider {
    @Inject(PlayerAnimationProvider)
    private playerAnimationProvider: PlayerAnimationProvider;

    @Inject(PlayerWalkstyleProvider)
    private playerWalkstyleProvider: PlayerWalkstyleProvider;

    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(AnimationService)
    private animationService: AnimationService;

    @Inject(DrawService)
    private draw: DrawService;

    @Inject(Notifier)
    private notifier: Notifier;

    private review: ReviewState | null = null;

    private previewing: AnimationReviewItem | null = null;

    public findReviewItem(command: string): AnimationReviewItem | null {
        if (!this.review) {
            return null;
        }

        const entry = this.review.pack.entries.find(entry => entry.key.toLowerCase() === command);

        return entry ? entry.item : null;
    }

    private currentEntry(): AnimationReviewEntry | null {
        return this.review ? this.review.pack.entries[this.review.index] : null;
    }

    private nextUndecidedIndex(from: number): number {
        const { entries } = this.review.pack;

        for (let offset = 1; offset <= entries.length; offset++) {
            const index = (from + offset) % entries.length;

            if (!this.review.decisions[entries[index].key]) {
                return index;
            }
        }

        return -1;
    }

    private async resetPreview() {
        const player = this.playerService.getPlayer();

        if (this.previewing?.type === 'walk') {
            await this.playerWalkstyleProvider.updateWalkStyle('override', null);
        }

        if (this.previewing?.type === 'mood') {
            if (player?.metadata.mood) {
                await this.playerWalkstyleProvider.applyMood(player.metadata.mood);
            } else {
                ClearFacialIdleAnimOverride(PlayerPedId());
            }
        }

        this.previewing = null;
        await this.animationService.stop();
        await wait(100);
    }

    private async playCurrent() {
        const entry = this.currentEntry();

        if (!entry) {
            return;
        }

        await this.resetPreview();

        const item = entry.item;
        this.previewing = item;

        if (item.type === 'walk') {
            await this.playerWalkstyleProvider.updateWalkStyle('override', item.walk);
        } else if (item.type === 'mood') {
            await this.playerWalkstyleProvider.applyMood(item.mood);
        } else {
            await this.playerAnimationProvider.playAnimation({ animationItem: item });
        }
    }

    private async move(index: number) {
        const { entries } = this.review.pack;

        this.review.index = (index + entries.length) % entries.length;
        await this.playCurrent();
    }

    private async decide(decision: AnimationReviewDecision) {
        const entry = this.currentEntry();
        const { pack, decisions } = this.review;
        const previous = decisions[entry.key];

        decisions[entry.key] = { decision, note: previous?.note };

        const saved = await emitRpc<boolean>(
            RpcServerEvent.ADMIN_ANIMATION_REVIEW_DECIDE,
            pack.id,
            entry.key,
            decision
        );

        if (!saved) {
            if (previous) {
                decisions[entry.key] = previous;
            } else {
                delete decisions[entry.key];
            }

            this.notifier.notify("Impossible d'enregistrer la décision.", 'error');

            return;
        }

        const next = this.nextUndecidedIndex(this.review.index);

        if (next === -1) {
            this.notifier.notify(`Pack ~g~${pack.id}~s~ entièrement trié.`, 'success');

            return;
        }

        await this.move(next);
    }

    private async stopReview() {
        if (!this.review) {
            return;
        }

        await this.resetPreview();
        this.review = null;
    }

    private async listPacks() {
        const packs = await emitRpc<AnimationReviewPackSummary[]>(RpcServerEvent.ADMIN_ANIMATION_REVIEW_LIST);

        if (!packs || packs.length === 0) {
            this.notifier.notify('Aucun pack à trier.', 'error');

            return;
        }

        for (const pack of packs) {
            console.log(
                `[epack] ${pack.id} - ${pack.title} : ${pack.decided}/${pack.count} triées, ${pack.kept} gardées`
            );
        }

        const pending = packs.find(pack => pack.decided < pack.count);

        this.notifier.notify(
            pending
                ? `${packs.length} packs (détails en F8). Prochain : ~b~/epack ${pending.id}~s~`
                : `${packs.length} packs, tous triés.`,
            'info'
        );
    }

    @Command('epack', {
        description: "Trier un pack d'emotes (/epack, /epack <pack>, /epack stop)",
        role: ['admin', 'staff'],
    })
    public async reviewPack(source: number, packId?: string) {
        if (!packId) {
            await this.listPacks();

            return;
        }

        if (packId === 'stop') {
            await this.stopReview();

            return;
        }

        const result = await emitRpc<{ pack: AnimationReviewPack; decisions: AnimationReviewDecisions } | null>(
            RpcServerEvent.ADMIN_ANIMATION_REVIEW_GET_PACK,
            packId
        );

        if (!result) {
            this.notifier.notify(`Pack ~r~${packId}~s~ introuvable.`, 'error');

            return;
        }

        await this.stopReview();

        this.review = { ...result, index: 0 };

        const first = result.decisions[result.pack.entries[0]?.key] ? this.nextUndecidedIndex(0) : 0;

        await this.move(first === -1 ? 0 : first);
    }

    @Command('enote', {
        description: "Ajouter une note à l'emote en cours de tri",
        role: ['admin', 'staff'],
    })
    public async noteEntry(source: number, ...words: string[]) {
        const entry = this.currentEntry();

        if (!entry) {
            return;
        }

        const verdict = this.review.decisions[entry.key];

        if (!verdict) {
            this.notifier.notify("Garde ou rejette l'emote avant d'ajouter une note.", 'error');

            return;
        }

        const note = words.join(' ').trim();
        const saved = await emitRpc<boolean>(
            RpcServerEvent.ADMIN_ANIMATION_REVIEW_DECIDE,
            this.review.pack.id,
            entry.key,
            verdict.decision,
            note
        );

        if (saved) {
            verdict.note = note || undefined;
            this.notifier.notify(`Note enregistrée pour ~b~${entry.key}~s~.`, 'success');
        }
    }

    @Tick()
    public async onReviewTick() {
        if (!this.review) {
            return;
        }

        for (const control of REVIEW_CONTROLS) {
            DisableControlAction(0, control, true);
        }

        const entry = this.currentEntry();
        const { pack, decisions, index } = this.review;
        const verdict = decisions[entry.key];
        const decided = Object.keys(decisions).length;
        const status = verdict ? (verdict.decision === 'keep' ? '~g~GARDÉE' : '~r~REJETÉE') : '~y~à trier';

        const lines = [
            `~b~${pack.title}~s~  ${index + 1}/${pack.entries.length}  (${decided} triées)`,
            `~w~${entry.label}  ~c~/e ${entry.key}~s~  [${entry.item.type}]  ${status}`,
            ...entry.notes.map(note => `~o~${note}`),
            ...(entry.duplicateOf ? [`~o~même anim que SOZ : ${entry.duplicateOf}`] : []),
            ...(verdict?.note ? [`~c~note : ${verdict.note}`] : []),
            '~c~← → naviguer   ↑ garder   ↓ rejeter   Entrée rejouer   Retour quitter   /enote <texte>',
        ];

        lines.forEach((line, i) => {
            this.draw.drawText(line, [0.01, 0.3 + i * 0.025], {
                font: Font.ChaletComprimeCologne,
                size: 0.4,
                outline: true,
            });
        });

        if (IsDisabledControlJustPressed(0, Control.PhoneLeft)) {
            await this.move(index - 1);
        } else if (IsDisabledControlJustPressed(0, Control.PhoneRight)) {
            await this.move(index + 1);
        } else if (IsDisabledControlJustPressed(0, Control.PhoneUp)) {
            await this.decide('keep');
        } else if (IsDisabledControlJustPressed(0, Control.PhoneDown)) {
            await this.decide('reject');
        } else if (IsDisabledControlJustPressed(0, Control.FrontendRDown)) {
            await this.playCurrent();
        } else if (IsDisabledControlJustPressed(0, Control.PhoneCancel)) {
            await this.stopReview();
        }
    }
}
