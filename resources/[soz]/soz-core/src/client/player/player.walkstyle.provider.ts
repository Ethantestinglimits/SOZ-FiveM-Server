import { Once, OnceStep } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { Provider } from '@core/decorators/provider';
import { PlayerUpdate } from '@public/core/decorators/player';

import { getAimStyle } from '../../config/animation';
import { PlayerData } from '../../shared/player';
import { ResourceLoader } from '../repository/resource.loader';
import { PlayerService } from './player.service';

export type WalkStyleConf = {
    override: string;
    injury: string;
    overloaded: string;
    drugAlcool: string;
    stress: string;
    item: string;
};

@Provider()
export class PlayerWalkstyleProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    @Inject(ResourceLoader)
    private resourceLoader: ResourceLoader;

    private conf: WalkStyleConf = {
        override: null,
        injury: null,
        overloaded: null,
        drugAlcool: null,
        stress: null,
        item: null,
    };

    private currentWalkStyle: string | null = null;
    private currentWeaponClipset: string | null = null;

    private async applyWalkStyle(base: string, transitionSpeed = 1.0): Promise<void> {
        const ped = PlayerPedId();

        let walkStyle = base;

        if (this.conf.override) {
            walkStyle = this.conf.override;
        } else if (this.conf.injury) {
            walkStyle = this.conf.injury;
        } else if (this.conf.overloaded) {
            walkStyle = this.conf.overloaded;
        } else if (this.conf.drugAlcool) {
            walkStyle = this.conf.drugAlcool;
        } else if (this.conf.stress) {
            walkStyle = this.conf.stress;
        } else if (this.conf.item) {
            walkStyle = this.conf.item;
        }

        this.currentWalkStyle = walkStyle;

        if (GetPedMovementClipset(ped) == GetHashKey(walkStyle)) {
            return;
        }

        ResetPedMovementClipset(ped, transitionSpeed);

        if (!walkStyle) {
            return;
        }

        await this.resourceLoader.loadAnimationSet(walkStyle);
        SetPedMovementClipset(ped, walkStyle, transitionSpeed);
    }

    private async applyWeaponClipset(aimStyleName: string | null): Promise<void> {
        const ped = PlayerPedId();
        const isCrouched = this.currentWalkStyle === 'move_ped_crouched';
        const aimStyle = getAimStyle(aimStyleName);

        const clipset = isCrouched ? 'move_ped_crouched' : aimStyle.clipset;
        const strafeClipset = isCrouched
            ? 'move_ped_crouched_strafing'
            : aimStyle.strafeClipset ?? aimStyle.clipset;

        if (this.currentWeaponClipset === clipset) {
            return;
        }
        this.currentWeaponClipset = clipset;

        if (!clipset) {
            ResetPedWeaponMovementClipset(ped);
            ResetPedStrafeClipset(ped);

            return;
        }

        await this.resourceLoader.loadClipSet(clipset);
        SetPedWeaponMovementClipset(ped, clipset);
        SetPedStrafeClipset(ped, strafeClipset);
    }

    async updateWalkStyle(kind: keyof WalkStyleConf, walkStyle: string | null, transitionSpeed = 1.0): Promise<void> {
        const player = this.playerService.getPlayer();
        if (!player) {
            return;
        }

        this.conf[kind] = walkStyle;
        await this.applyWalkStyle(player.metadata.walk, transitionSpeed);
    }

    async applyMood(mood: string | null): Promise<void> {
        if (mood === null || mood === '') {
            return;
        }

        SetFacialIdleAnimOverride(PlayerPedId(), mood, null);
    }

    @Once(OnceStep.PlayerLoaded, true)
    async setupPlayerWalkstyle(player: PlayerData): Promise<void> {
        if (player.metadata.walk) {
            await this.applyWalkStyle(player.metadata.walk);
        }

        await this.applyWeaponClipset(player.metadata.aimStyle);

        if (player.metadata.mood) {
            await this.applyMood(player.metadata.mood);
        }
    }

    @PlayerUpdate()
    async onPlayerUpdate(player: PlayerData): Promise<void> {
        if (player.metadata.walk) {
            await this.applyWalkStyle(player.metadata.walk);
        }

        await this.applyWeaponClipset(player.metadata.aimStyle);

        if (player.metadata.mood) {
            await this.applyMood(player.metadata.mood);
        }
    }
}
