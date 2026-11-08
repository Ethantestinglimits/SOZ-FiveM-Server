import { init, RematchDispatch, RematchRootState } from '@rematch/core';

import { hudPreviewMiddleware } from './components/Hud/hudPreview';
import { models, RootModel } from './models';

export const store = init({
    models,
    redux: {
        middlewares: [hudPreviewMiddleware],
    },
});

export type Store = typeof store;
export type Dispatch = RematchDispatch<RootModel>;
export type RootState = RematchRootState<RootModel>;
