import { Animations, Moods, Walks } from '../../config/animation';
import { Command } from '../../core/decorators/command';
import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { AnimationConfigItem, AnimationReviewItem, WalkConfigItem } from '../../shared/animation';
import { Notifier } from '../notifier';
import { PlayerAnimationProvider } from '../player/player.animation.provider';
import { AnimationReviewProvider } from './animation.review.provider';

@Provider()
export class AnimationEmoteProvider {
    @Inject(PlayerAnimationProvider)
    private playerAnimationProvider: PlayerAnimationProvider;

    @Inject(AnimationReviewProvider)
    private animationReviewProvider: AnimationReviewProvider;

    @Inject(Notifier)
    private notifier: Notifier;

    private emotes: Map<string, AnimationReviewItem> | null = null;

    private indexItems(items: (AnimationConfigItem | WalkConfigItem)[], emotes: Map<string, AnimationReviewItem>) {
        for (const item of items) {
            if (item.type === 'category') {
                this.indexItems(item.items, emotes);
            } else if (item.type !== 'event' && item.command && !emotes.has(item.command.toLowerCase())) {
                emotes.set(item.command.toLowerCase(), item);
            }
        }
    }

    private getEmotes(): Map<string, AnimationReviewItem> {
        if (!this.emotes) {
            this.emotes = new Map();
            this.indexItems(Animations, this.emotes);
            this.indexItems(Walks, this.emotes);

            for (const mood of Moods) {
                if (mood.command && !this.emotes.has(mood.command.toLowerCase())) {
                    this.emotes.set(mood.command.toLowerCase(), { ...mood, type: 'mood' });
                }
            }
        }

        return this.emotes;
    }

    public async playItem(item: AnimationReviewItem) {
        if (item.type === 'mood') {
            await this.playerAnimationProvider.setMoodAnimation({ moodItem: item });

            return;
        }

        await this.playerAnimationProvider.playAnimation({ animationItem: item });
    }

    @Command('e', {
        description: 'Jouer une emote (/e nom, /e c pour arrêter)',
    })
    public async emote(source: number, name?: string) {
        if (!name || name === 'c' || name === 'stop') {
            this.playerAnimationProvider.animationStop();

            return;
        }

        const command = name.toLowerCase();
        const item = this.getEmotes().get(command) || this.animationReviewProvider.findReviewItem(command);

        if (!item) {
            this.notifier.notify(`Emote ~r~${name}~s~ introuvable.`, 'error');

            return;
        }

        await this.playItem(item);
    }
}
