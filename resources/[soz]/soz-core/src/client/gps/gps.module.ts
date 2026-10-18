import { Module } from '../../core/decorators/module';
import { GpsColorProvider } from './gps.color.provider';

@Module({
    providers: [GpsColorProvider],
})
export class GpsModule {}
