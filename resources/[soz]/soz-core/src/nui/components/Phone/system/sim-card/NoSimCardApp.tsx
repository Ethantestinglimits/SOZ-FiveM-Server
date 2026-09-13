import { BanIcon } from '@heroicons/react/outline';
import { FunctionComponent } from 'react';

import { AppContainer } from '../../components/system/AppContainer';

export const NoSimCardApp: FunctionComponent = () => {
    return (
        <AppContainer className="font-prompt text-white bg-black/90" disableBackground forceControlColor="light">
            <div className="flex flex-col items-center justify-center h-full px-8 pb-20 text-center">
                <BanIcon className="w-20 h-20 mb-6 text-white/60" />

                <div className="text-2xl font-light">Aucune Carte ZIM</div>
                <div className="mt-3 text-base font-light text-white/70">
                    Aucune Carte ZIM présente dans ce téléphone.
                </div>
            </div>
        </AppContainer>
    );
};
