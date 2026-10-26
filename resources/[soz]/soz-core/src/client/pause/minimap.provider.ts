import { Inject } from '../../core/decorators/injectable';
import { Provider } from '../../core/decorators/provider';
import { Tick, TickInterval } from '../../core/decorators/tick';
import { BlipType } from '../../shared/blip';
import { MinimapBlip, MinimapZone } from '../../shared/nui/minimap';
import { BlipFactory } from '../blip';
import { HudMinimapProvider } from '../hud/hud.minimap.provider';
import { NuiDispatch } from '../nui/nui.dispatch';
import { PauseMenuProvider } from './pause.menu.provider';

const MAX_BLIP_SPRITE = 1000;
const BLIP_SPRITES_PER_TICK = 100;
const WAYPOINT_BLIP_SPRITE = 8;
const RADIUS_BLIP_SPRITES = [9, 10];
const HIDDEN_BLIP_DISPLAYS = [0, 5];
const FRAME_INTERVAL = 33;

@Provider()
export class PauseMinimapProvider {
    @Inject(NuiDispatch)
    private nuiDispatch: NuiDispatch;

    @Inject(HudMinimapProvider)
    private hudMinimapProvider: HudMinimapProvider;

    @Inject(BlipFactory)
    private blipFactory: BlipFactory;

    @Inject(PauseMenuProvider)
    private pauseMenuProvider: PauseMenuProvider;

    public frameInterval = FRAME_INTERVAL;

    private lastFrameAt = 0;
    private scanSprite = 0;
    private scanBlips: MinimapBlip[] = [];
    private scanExcluded = new Set<number>();
    private blipSignature = '';
    private zoneSignature = '';

    @Tick(TickInterval.EVERY_FRAME)
    public onFrame(): void {
        const now = GetGameTimer();

        if (now - this.lastFrameAt < this.frameInterval) {
            return;
        }

        this.lastFrameAt = now;

        const ped = PlayerPedId();
        const vehicle = GetVehiclePedIsIn(ped, false);
        const entity = vehicle || ped;
        const [x, y] = GetEntityCoords(ped, false);
        const [, , camHeading] = GetGameplayCamRot(2);

        this.nuiDispatch.dispatch('minimap', 'Frame', {
            x,
            y,
            heading: GetEntityHeading(ped),
            camHeading,
            speed: GetEntitySpeed(entity),
            altitude: GetEntityHeightAboveGround(entity),
            visible:
                this.hudMinimapProvider.radarWanted &&
                IsGameplayCamRendering() &&
                !IsPauseMenuActive() &&
                !this.pauseMenuProvider.isOpen(),
        });
    }

    @Tick(100)
    public onBlips(): void {
        if (this.scanSprite === 0) {
            this.scanBlips = [];
            this.scanExcluded = new Set([GetMainPlayerBlipId(), GetNorthRadarBlip()]);
        }

        const end = Math.min(MAX_BLIP_SPRITE, this.scanSprite + BLIP_SPRITES_PER_TICK - 1);

        this.scanBlipRange(this.scanSprite, end);

        if (end < MAX_BLIP_SPRITE) {
            this.scanSprite = end + 1;

            return;
        }

        this.scanSprite = 0;

        const signature = this.scanBlips.map(blip => `${blip.sprite}:${blip.color}:${blip.x}:${blip.y}`).join('|');

        if (signature !== this.blipSignature) {
            this.blipSignature = signature;
            this.nuiDispatch.dispatch('minimap', 'Blips', this.scanBlips);
        }

        this.dispatchZones();
    }

    private dispatchZones(): void {
        const zones: MinimapZone[] = [];

        for (const { gameId, blip } of this.blipFactory.getAll().values()) {
            if (blip.type !== BlipType.Radius || blip.hidden || !blip.radius || !DoesBlipExist(gameId)) {
                continue;
            }

            const [x, y] = GetBlipCoords(gameId);

            zones.push({ x, y, radius: blip.radius, color: blip.color ?? 0, alpha: blip.alpha ?? 128 });
        }

        const signature = zones.map(zone => `${zone.x}:${zone.y}:${zone.radius}:${zone.color}:${zone.alpha}`).join('|');

        if (signature !== this.zoneSignature) {
            this.zoneSignature = signature;
            this.nuiDispatch.dispatch('minimap', 'Zones', zones);
        }
    }

    private scanBlipRange(from: number, to: number): void {
        for (let sprite = from; sprite <= to; sprite++) {
            if (sprite === WAYPOINT_BLIP_SPRITE || RADIUS_BLIP_SPRITES.includes(sprite)) {
                continue;
            }

            for (let handle = GetFirstBlipInfoId(sprite); DoesBlipExist(handle); handle = GetNextBlipInfoId(sprite)) {
                if (
                    this.scanExcluded.has(handle) ||
                    GetBlipAlpha(handle) === 0 ||
                    HIDDEN_BLIP_DISPLAYS.includes(GetBlipInfoIdDisplay(handle))
                ) {
                    continue;
                }

                const [x, y] = GetBlipCoords(handle);

                this.scanBlips.push({
                    x,
                    y,
                    sprite: GetBlipSprite(handle),
                    color: GetBlipColour(handle),
                    rotation: GetBlipRotation(handle),
                });
            }
        }
    }
}
