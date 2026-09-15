import { LockClosedIcon } from '@heroicons/react/solid';
import { FunctionComponent, useEffect, useState } from 'react';

import { NuiEvent } from '../../../../../shared/event/nui';
import { PhoneDeviceUnlockResult } from '../../../../../shared/phone/device';
import { fetchNui } from '../../../../fetch';
import { useAssetPath } from '../../../../hook/assets';
import { AppContainer } from '../../components/system/AppContainer';
import { useWallpaperConfig } from '../config/config.atom';
import { isDefaultWallpaper } from '../config/utils/wallpaper';
import { usePhoneTime } from '../phone.atom';
import { EmergencyDirectory } from './components/EmergencyDirectory';
import { PinPad } from './components/PinPad';

export const LockScreenApp: FunctionComponent = () => {
    const time = usePhoneTime();
    const wallpaper = useWallpaperConfig();
    const { getPath } = useAssetPath();

    const [pinCode, setPinCode] = useState('');
    const [errorKey, setErrorKey] = useState(0);
    const [retryIn, setRetryIn] = useState(0);
    const [pending, setPending] = useState(false);
    const [emergencyOpen, setEmergencyOpen] = useState(false);

    useEffect(() => {
        if (retryIn <= 0) {
            return;
        }

        const timeout = setTimeout(() => setRetryIn(value => value - 1), 1000);

        return () => clearTimeout(timeout);
    }, [retryIn]);

    const submit = async (code: string) => {
        setPending(true);

        const result = await fetchNui<{ pinCode: string }, PhoneDeviceUnlockResult>(NuiEvent.PhoneDeviceUnlock, {
            pinCode: code,
        });

        setPending(false);

        if (result?.device) {
            return;
        }

        setErrorKey(value => value + 1);
        setTimeout(() => setPinCode(''), 350);

        if (result?.error === 'too_many_attempts') {
            setRetryIn(result.retryIn);
        }
    };

    const isBlocked = retryIn > 0;

    const wallpaperUrl = isDefaultWallpaper(wallpaper) ? getPath(`images/phone/backgrounds/${wallpaper}`) : wallpaper;

    return (
        <AppContainer
            className="relative overflow-hidden text-white"
            disableBackground
            withHeader={false}
            withNavBar={false}
        >
            <div
                className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl"
                style={{ backgroundImage: `url(${wallpaperUrl})` }}
            />
            <div className="absolute inset-0 bg-black/50" />

            {emergencyOpen ? (
                <div className="relative h-full">
                    <EmergencyDirectory onClose={() => setEmergencyOpen(false)} />
                </div>
            ) : (
                <div className="relative flex flex-col items-center h-full pt-16 pb-12">
                    <LockClosedIcon className="h-7 w-7 opacity-90" />

                    <div className="mt-2 text-[84px] leading-none font-semibold tracking-tight">{time}</div>

                    <div className="flex flex-1 flex-col items-center justify-center">
                        <div className="mb-8 flex flex-col items-center text-center">
                            <p className="text-[20px]">{isBlocked ? 'Téléphone désactivé' : 'Saisissez le code'}</p>
                            <p className="h-6 mt-1 text-[15px] opacity-70">
                                {isBlocked ? `Réessayez dans ${retryIn} s` : ''}
                            </p>
                        </div>

                        <PinPad
                            value={pinCode}
                            onChange={setPinCode}
                            onComplete={submit}
                            errorKey={errorKey}
                            disabled={pending || isBlocked}
                            variant="dark"
                            leftAction={{
                                label: 'SOS',
                                onClick: () => {
                                    setPinCode('');
                                    setEmergencyOpen(true);
                                },
                            }}
                        />
                    </div>
                </div>
            )}
        </AppContainer>
    );
};
