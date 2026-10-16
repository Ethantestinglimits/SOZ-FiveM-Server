import { Module } from '../../core/decorators/module';
import { TaserDazeProvider } from './taser.daze.provider';
import { WeaponDrawingProvider } from './weapon.drawing.provider';
import { WeaponGunsmithProvider } from './weapon.gunsmith.provider';
import { WeaponProvider } from './weapon.provider';

@Module({
    providers: [WeaponProvider, WeaponDrawingProvider, WeaponGunsmithProvider, TaserDazeProvider],
})
export class WeaponModule {}
