import { Module } from '../../core/decorators/module';
import { TaserDazeProvider } from './taser.daze.provider';
import { WeaponGunsmithProvider } from './weapon.gunsmith.provider';
import { WeaponProvider } from './weapon.provider';

@Module({
    providers: [WeaponProvider, WeaponGunsmithProvider, TaserDazeProvider],
})
export class WeaponModule {}
