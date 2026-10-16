import { Module } from '../../core/decorators/module';
import { TaserDazeProvider } from './taser.daze.provider';
import { TaserDazeRemoteWalkProvider } from './taser.daze.remote.walk.provider';
import { TaserDazeStumbleProvider } from './taser.daze.stumble.provider';
import { WeaponDrawingProvider } from './weapon.drawing.provider';
import { WeaponGunsmithProvider } from './weapon.gunsmith.provider';
import { WeaponProvider } from './weapon.provider';

@Module({
    providers: [
        WeaponProvider,
        WeaponDrawingProvider,
        WeaponGunsmithProvider,
        TaserDazeProvider,
        TaserDazeStumbleProvider,
        TaserDazeRemoteWalkProvider,
    ],
})
export class WeaponModule {}
