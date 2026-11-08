import { Module } from '../../core/decorators/module';
import { GpsVehicleProvider } from './gps.vehicle.provider';

@Module({
    providers: [GpsVehicleProvider],
})
export class GpsModule {}
