import { Module } from '../../core/decorators/module';
import { GpsColorProvider } from './gps.color.provider';
import { GpsVehiclePointProvider } from './gps.vehicle.point.provider';

@Module({
    providers: [GpsColorProvider, GpsVehiclePointProvider],
})
export class GpsModule {}
