import { Module } from '../../core/decorators/module';
import { GraffitiProvider } from './graffiti.provider';
import { GraffitiRenderProvider } from './graffiti.render.provider';

@Module({
    providers: [GraffitiProvider, GraffitiRenderProvider],
})
export class GraffitiModule {}
