import { Module } from '../../core/decorators/module';
import { GraffitiProvider } from './graffiti.provider';

@Module({
    providers: [GraffitiProvider],
})
export class GraffitiModule {}
