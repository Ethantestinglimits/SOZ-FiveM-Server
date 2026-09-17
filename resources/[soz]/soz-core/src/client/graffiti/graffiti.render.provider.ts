import { Inject } from '@public/core/decorators/injectable';
import { Provider } from '@public/core/decorators/provider';
import { Tick, TickInterval } from '@public/core/decorators/tick';
import { GRAFFITI_HEIGHT, GRAFFITI_TEXTURE_DICT, GRAFFITI_WIDTH } from '@public/shared/graffiti';
import { applyOffset, Vector4 } from '@public/shared/polyzone/vector';

import { ObjectProvider } from '../object/object.provider';
import { TextureReplacerProvider } from '../object/texture.replacer.provider';

/**
 * Draws each placed graffiti's image as a textured quad in world space instead of baking it onto
 * a prop's texture slot, since AddReplaceTexture swaps a texture dict/name pair for every entity
 * using it in the world - this lets every graffiti show its own independent image without needing
 * a dedicated model variant per instance.
 */
@Provider()
export class GraffitiRenderProvider {
    @Inject(ObjectProvider)
    private objectProvider: ObjectProvider;

    @Inject(TextureReplacerProvider)
    private textureReplacerProvider: TextureReplacerProvider;

    @Tick(TickInterval.EVERY_FRAME, 'graffiti-render')
    public renderGraffitis() {
        const graffitis = this.objectProvider.getLoadedObjects(object => !!object.metadata?.imageUrl);

        for (const graffiti of graffitis) {
            const url = graffiti.metadata?.imageUrl;
            if (!url) {
                continue;
            }

            if (!this.textureReplacerProvider.isTextureLoaded(url)) {
                this.textureReplacerProvider.loadTexture(url);
                continue;
            }

            this.drawGraffiti(graffiti.position, url);
        }
    }

    private drawGraffiti(position: Vector4, textureName: string) {
        const topRight = applyOffset(position, [GRAFFITI_WIDTH / 2, 0, GRAFFITI_HEIGHT]);
        const bottomRight = applyOffset(position, [GRAFFITI_WIDTH / 2, 0, 0]);
        const topLeft = applyOffset(position, [-GRAFFITI_WIDTH / 2, 0, GRAFFITI_HEIGHT]);
        const bottomLeft = applyOffset(position, [-GRAFFITI_WIDTH / 2, 0, 0]);

        DrawTexturedPoly(
            topRight[0],
            topRight[1],
            topRight[2],
            topLeft[0],
            topLeft[1],
            topLeft[2],
            bottomRight[0],
            bottomRight[1],
            bottomRight[2],
            255,
            255,
            255,
            255,
            GRAFFITI_TEXTURE_DICT,
            textureName,
            1,
            0,
            1,
            0,
            0,
            1,
            1,
            1,
            1
        );
        DrawTexturedPoly(
            topLeft[0],
            topLeft[1],
            topLeft[2],
            bottomLeft[0],
            bottomLeft[1],
            bottomLeft[2],
            bottomRight[0],
            bottomRight[1],
            bottomRight[2],
            255,
            255,
            255,
            255,
            GRAFFITI_TEXTURE_DICT,
            textureName,
            0,
            0,
            1,
            0,
            1,
            1,
            1,
            1,
            1
        );
    }
}
