import { Module } from '../../core/decorators/module';
import { GpsProvider } from './gps.provider';

@Module({
    providers: [GpsProvider],
})
export class GpsModule {}
