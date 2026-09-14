import { CheckIcon, ChevronRightIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

import { NuiEvent } from '../../../../../shared/event/nui';
import { PhoneConfig, SettingOption } from '../../../../../shared/phone/config';
import { PhoneDeviceSetup } from '../../../../../shared/phone/device';
import { fetchNui } from '../../../../fetch';
import { useAssetPath } from '../../../../hook/assets';
import { AppContainer } from '../../components/system/AppContainer';
import { toDeviceSettings, useConfig } from '../config/config.atom';
import { ringtoneOptions, themeOptions, wallpaperOptions } from '../config/config.constant';
import { PinPad } from '../lock/components/PinPad';
import { useSoundProvider } from '../sound/providers/SoundProvider';
import { SetupButton, SetupScreen } from './components/SetupScreen';
import { ZFACE_TICKS, ZFaceGlyph, ZFaceScanner } from './components/ZFaceScanner';

type SetupStep = 'hello' | 'appearance' | 'wallpaper' | 'ringtone' | 'passcode' | 'passcodeConfirm' | 'zFace' | 'done';

const STEPS: SetupStep[] = [
    'hello',
    'appearance',
    'wallpaper',
    'ringtone',
    'passcode',
    'passcodeConfirm',
    'zFace',
    'done',
];

const GREETINGS = ['Bonjour', 'Hello', 'Hola', 'Ciao', 'Hallo', 'Olá', 'Привет', 'こんにちは'];

type ZFaceStatus = 'idle' | 'scanning' | 'completed';

export const SetupApp: FunctionComponent = () => {
    const config = useConfig();
    const sound = useSoundProvider();
    const { getPath } = useAssetPath();

    const [step, setStep] = useState<SetupStep>('hello');
    const [draft, setDraft] = useState<PhoneConfig>(config);

    const [pinCode, setPinCode] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [pinErrorKey, setPinErrorKey] = useState(0);
    const [pinMismatch, setPinMismatch] = useState(false);

    const [zFaceStatus, setZFaceStatus] = useState<ZFaceStatus>('idle');
    const [zFaceProgress, setZFaceProgress] = useState(0);

    const [greetingIndex, setGreetingIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(false);

    const previewedSound = useRef<string | null>(null);

    const dark = draft.theme.value === 'dark';

    useEffect(() => {
        if (step !== 'hello') {
            return;
        }

        const interval = setInterval(() => setGreetingIndex(index => (index + 1) % GREETINGS.length), 1600);

        return () => clearInterval(interval);
    }, [step]);

    useEffect(() => {
        if (zFaceStatus !== 'scanning') {
            return;
        }

        const interval = setInterval(() => {
            setZFaceProgress(progress => Math.min(progress + 1, ZFACE_TICKS));
        }, 50);

        return () => clearInterval(interval);
    }, [zFaceStatus]);

    useEffect(() => {
        if (zFaceStatus === 'scanning' && zFaceProgress >= ZFACE_TICKS) {
            setZFaceStatus('completed');
        }
    }, [zFaceStatus, zFaceProgress]);

    const stopPreview = () => {
        if (previewedSound.current) {
            sound.stop(previewedSound.current);
            previewedSound.current = null;
        }
    };

    useEffect(() => {
        if (step !== 'ringtone') {
            stopPreview();
        }
    }, [step]);

    useEffect(() => () => stopPreview(), []);

    const goTo = (target: SetupStep) => setStep(target);

    const next = () => goTo(STEPS[Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1)]);

    const back = () => {
        if (step === 'passcodeConfirm') {
            setPinCode('');
            setPinConfirm('');
        }

        goTo(STEPS[Math.max(STEPS.indexOf(step) - 1, 0)]);
    };

    const updateDraft = <K extends keyof PhoneConfig>(key: K, value: PhoneConfig[K]) =>
        setDraft(current => ({ ...current, [key]: value }));

    const selectRingtone = (option: SettingOption<string>) => {
        stopPreview();
        updateDraft('ringtone', option);

        const url = getPath(`audio/phone/ringtones/${option.value}.mp3`);

        sound.play(url, 0.1, false);
        previewedSound.current = url;
    };

    const onPinCreated = (code: string) => {
        setPinMismatch(false);
        setTimeout(() => goTo('passcodeConfirm'), 200);
        setPinCode(code);
    };

    const onPinConfirmed = (code: string) => {
        if (code === pinCode) {
            setTimeout(next, 200);

            return;
        }

        setPinErrorKey(key => key + 1);
        setPinMismatch(true);

        setTimeout(() => {
            setPinCode('');
            setPinConfirm('');
            goTo('passcode');
        }, 600);
    };

    const submit = async () => {
        setSubmitting(true);
        setSubmitError(false);

        const success = await fetchNui<PhoneDeviceSetup, boolean>(NuiEvent.PhoneDeviceSetup, {
            settings: toDeviceSettings(draft),
            pinCode,
        });

        setSubmitting(false);

        if (!success) {
            setSubmitError(true);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'hello':
                return (
                    <div
                        key="hello"
                        className="flex flex-col items-center justify-between h-full w-full bg-white text-black cursor-pointer pt-40 pb-16"
                        onClick={next}
                    >
                        <p
                            key={greetingIndex}
                            className="text-[64px] font-semibold tracking-tight text-black animate-display-persist"
                        >
                            {GREETINGS[greetingIndex]}
                        </p>

                        <div className="flex flex-col items-center gap-3 text-neutral-500">
                            <div className="w-14 h-14 rounded-full border border-neutral-300 flex items-center justify-center">
                                <ChevronRightIcon className="w-8 h-8 text-black" />
                            </div>
                            <span className="text-[15px]">Appuyez pour configurer</span>
                        </div>
                    </div>
                );

            case 'appearance':
                return (
                    <SetupScreen
                        key="appearance"
                        dark={dark}
                        title="Apparence"
                        subtitle="Choisissez l'apparence de votre téléphone. Vous pourrez la modifier dans Réglages."
                        onBack={back}
                        footer={<SetupButton onClick={next}>Continuer</SetupButton>}
                    >
                        <div className="flex justify-center gap-10 mt-4">
                            {themeOptions.map(option => {
                                const selected = draft.theme.value === option.value;
                                const optionDark = option.value === 'dark';

                                return (
                                    <button
                                        key={option.value}
                                        className="flex flex-col items-center gap-4"
                                        onClick={() => updateDraft('theme', option)}
                                    >
                                        <div
                                            className={clsx(
                                                'w-[112px] h-[228px] rounded-[24px] border-[5px] p-3 grid grid-cols-3 content-start gap-2',
                                                {
                                                    'bg-neutral-900 border-neutral-700': optionDark,
                                                    'bg-neutral-100 border-neutral-300': !optionDark,
                                                }
                                            )}
                                        >
                                            {Array.from({ length: 12 }).map((_, index) => (
                                                <div
                                                    key={index}
                                                    className={clsx('aspect-square rounded-[6px]', {
                                                        'bg-neutral-700': optionDark,
                                                        'bg-neutral-300': !optionDark,
                                                    })}
                                                />
                                            ))}
                                        </div>

                                        <span className="text-[16px] font-medium">
                                            {optionDark ? 'Sombre' : 'Clair'}
                                        </span>

                                        <div
                                            className={clsx(
                                                'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                                                {
                                                    'bg-[#0A84FF] border-[#0A84FF]': selected,
                                                    'border-neutral-400': !selected,
                                                }
                                            )}
                                        >
                                            {selected && <CheckIcon className="w-4 h-4 text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </SetupScreen>
                );

            case 'wallpaper':
                return (
                    <SetupScreen
                        key="wallpaper"
                        dark={dark}
                        title="Fond d'écran"
                        subtitle="Choisissez le fond d'écran de votre téléphone."
                        onBack={back}
                        footer={<SetupButton onClick={next}>Continuer</SetupButton>}
                    >
                        <div
                            className={clsx(
                                'grid grid-cols-3 gap-3 overflow-y-auto pb-2 pr-2 scrollbar scrollbar-w-[5px] scrollbar-thumb-rounded-full scrollbar-track-rounded-full',
                                {
                                    'scrollbar-thumb-white/80': dark,
                                    'scrollbar-thumb-black/20': !dark,
                                }
                            )}
                        >
                            {wallpaperOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => updateDraft('wallpaper', option)}
                                    className={clsx('relative aspect-[9/16] rounded-[14px] bg-cover bg-center', {
                                        'ring-[3px] ring-[#0A84FF] ring-offset-2':
                                            draft.wallpaper.value === option.value,
                                        'ring-offset-black': dark,
                                        'ring-offset-white': !dark,
                                    })}
                                    style={{
                                        backgroundImage: `url(${getPath(`images/phone/backgrounds/${option.value}`)})`,
                                    }}
                                >
                                    {draft.wallpaper.value === option.value && (
                                        <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-[#0A84FF] flex items-center justify-center">
                                            <CheckIcon className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </SetupScreen>
                );

            case 'ringtone':
                return (
                    <SetupScreen
                        key="ringtone"
                        dark={dark}
                        title="Sonnerie"
                        subtitle="Touchez une sonnerie pour l'écouter."
                        onBack={back}
                        footer={<SetupButton onClick={next}>Continuer</SetupButton>}
                    >
                        <div
                            className={clsx('rounded-[14px] overflow-hidden', {
                                'bg-neutral-900': dark,
                                'bg-neutral-100': !dark,
                            })}
                        >
                            {ringtoneOptions.map((option, index) => (
                                <button
                                    key={option.value}
                                    onClick={() => selectRingtone(option)}
                                    className={clsx(
                                        'flex items-center justify-between w-full h-[52px] px-4 text-[17px]',
                                        {
                                            'border-t border-neutral-800': dark && index > 0,
                                            'border-t border-neutral-300': !dark && index > 0,
                                        }
                                    )}
                                >
                                    <span>{option.label}</span>
                                    {draft.ringtone.value === option.value && (
                                        <CheckIcon className="w-6 h-6 text-[#0A84FF]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </SetupScreen>
                );

            case 'passcode':
                return (
                    <SetupScreen
                        key="passcode"
                        dark={dark}
                        title="Créer un code"
                        subtitle={
                            pinMismatch
                                ? 'Les codes ne correspondent pas. Réessayez.'
                                : "Ce code à 4 chiffres protège vos données si quelqu'un d'autre utilise votre téléphone."
                        }
                        onBack={back}
                    >
                        <div className="flex flex-1 items-center justify-center pb-10">
                            <PinPad
                                value={pinCode}
                                onChange={setPinCode}
                                onComplete={onPinCreated}
                                errorKey={pinErrorKey}
                                variant={dark ? 'dark' : 'light'}
                            />
                        </div>
                    </SetupScreen>
                );

            case 'passcodeConfirm':
                return (
                    <SetupScreen
                        key="passcodeConfirm"
                        dark={dark}
                        title="Confirmez le code"
                        subtitle="Saisissez à nouveau votre code."
                        onBack={back}
                    >
                        <div className="flex flex-1 items-center justify-center pb-10">
                            <PinPad
                                value={pinConfirm}
                                onChange={setPinConfirm}
                                onComplete={onPinConfirmed}
                                errorKey={pinErrorKey}
                                variant={dark ? 'dark' : 'light'}
                            />
                        </div>
                    </SetupScreen>
                );

            case 'zFace':
                return (
                    <SetupScreen
                        key="zFace"
                        dark={dark}
                        title={
                            zFaceStatus === 'completed'
                                ? 'ZFace est configuré'
                                : zFaceStatus === 'scanning'
                                  ? 'Déplacez lentement la tête…'
                                  : 'ZFace'
                        }
                        subtitle={
                            zFaceStatus === 'completed'
                                ? 'Votre téléphone se déverrouillera instantanément lorsque vous le regarderez.'
                                : 'Configurez ZFace pour déverrouiller votre téléphone d’un simple regard.'
                        }
                        onBack={zFaceStatus === 'scanning' ? undefined : back}
                        footer={
                            zFaceStatus === 'completed' ? (
                                <SetupButton onClick={next}>Continuer</SetupButton>
                            ) : (
                                <SetupButton
                                    disabled={zFaceStatus === 'scanning'}
                                    onClick={() => {
                                        setZFaceProgress(0);
                                        setZFaceStatus('scanning');
                                    }}
                                >
                                    Commencer
                                </SetupButton>
                            )
                        }
                    >
                        <div className="flex flex-1 items-center justify-center">
                            {zFaceStatus === 'idle' ? (
                                <ZFaceGlyph className="w-[120px] h-[120px] text-[#0A84FF]" />
                            ) : (
                                <ZFaceScanner
                                    progress={zFaceProgress}
                                    completed={zFaceStatus === 'completed'}
                                    dark={dark}
                                />
                            )}
                        </div>
                    </SetupScreen>
                );

            case 'done':
                return (
                    <SetupScreen
                        key="done"
                        dark={dark}
                        title="Bienvenue sur ZPhone"
                        subtitle={
                            submitError
                                ? 'La configuration a échoué. Réessayez.'
                                : 'Votre téléphone est prêt à être utilisé.'
                        }
                        icon={
                            <div className="w-[96px] h-[96px] rounded-full bg-[#0A84FF] flex items-center justify-center mt-20">
                                <CheckIcon className="w-16 h-16 text-white" />
                            </div>
                        }
                        footer={
                            <SetupButton disabled={submitting} onClick={submit}>
                                Commencer
                            </SetupButton>
                        }
                    />
                );
        }
    };

    return (
        <AppContainer
            className={clsx('transition-colors duration-500', {
                'bg-black text-white': step !== 'hello' && dark,
                'bg-white text-black': step === 'hello' || !dark,
            })}
            disableBackground
            withHeader={false}
            withNavBar={false}
        >
            {renderStep()}
        </AppContainer>
    );
};
