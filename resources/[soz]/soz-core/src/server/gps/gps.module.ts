import { Module } from '../../core/decorators/module';
import { GpsVehiclePointProvider } from './gps.vehicle.point.provider';

@Module({
    providers: [GpsVehiclePointProvider],
})
export class GpsModule {}
