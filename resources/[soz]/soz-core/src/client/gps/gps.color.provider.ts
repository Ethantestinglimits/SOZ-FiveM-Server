import { Once, OnceStep, OnNuiEvent } from '@core/decorators/event';
import { Inject } from '@core/decorators/injectable';
import { PlayerUpdate } from '@core/decorators/player';
import { Provider } from '@core/decorators/provider';
import { NuiEvent, ServerEvent } from '@public/shared/event';
import { findGpsColor, GpsColorOption, isGpsBlipColor } from '@public/shared/gps';
import { PlayerData } from '@public/shared/player';

import { PlayerService } from '../player/player.service';

const HUD_COLOUR_WAYPOINT = 142;

@Provider()
export class GpsColorProvider {
    @Inject(PlayerService)
    private playerService: PlayerService;

    private savedBlipColor: number | null | undefined;

    public getColor(): GpsColorOption {
        return findGpsColor(this.playerService.getPlayer()?.metadata.gpscolor);
    }

    @OnNuiEvent(NuiEvent.PlayerMenuGpsSetColor)
    public async setColor({ blipColor }: { blipColor: number }): Promise<void> {
        if (!isGpsBlipColor(blipColor)) {
            return;
        }

        TriggerServerEvent(ServerEvent.QBCORE_SET_METADATA, 'gpscolor', blipColor);
        this.applyWaypointColor(findGpsColor(blipColor));
    }

    @Once(OnceStep.PlayerLoaded, true)
    @PlayerUpdate()
    public onPlayerUpdate(player: PlayerData): void {
        if (player.metadata.gpscolor === this.savedBlipColor) {
            return;
        }

        this.savedBlipColor = player.metadata.gpscolor;
        this.applyWaypointColor(findGpsColor(player.metadata.gpscolor));
    }

    private applyWaypointColor(gpsColor: GpsColorOption): void {
        const [r, g, b] = gpsColor.rgb;

        ReplaceHudColourWithRgba(HUD_COLOUR_WAYPOINT, r, g, b, 255);
    }
}
