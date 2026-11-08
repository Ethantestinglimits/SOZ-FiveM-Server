import './addons';

import {
    AdjustmentsIcon,
    CogIcon,
    LogoutIcon,
    MapIcon,
    PlayIcon,
    VolumeOffIcon,
    VolumeUpIcon,
    XIcon,
} from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { NuiEvent } from '../../../shared/event';
import { PauseMapLayer, PauseMenuData } from '../../../shared/nui/pause_menu';
import { fetchNui } from '../../fetch';
import { useKeyPress } from '../../hook/control';
import { useNuiEvent, useNuiFocus } from '../../hook/nui';
import { setVolumes } from '../../utils/volumes';
import { useHudColor } from '../Hud/hooks/useHudColor';
import { minimapController, setMapTabActive, useMinimapMode } from '../Minimap/minimapState';
import { FOCUS_RING_CLASSES, NAV_ZONE_ATTRIBUTE, useKeyboardNav } from './keyboardNav';
import { MapSidebar } from './MapSidebar';
import { getPauseTabs } from './pauseTabs';
import { setNativeHover, useKeyCapture, useNativeBackdrop, useNativeHover } from './settings/nativeInputState';
import { ToasterIcon } from './settings/rowControls';
import { SettingsMain, SettingsSidebar } from './settings/SettingsView';

type PauseMenuTab = string;

const TABS: { id: PauseMenuTab; label: string; icon: ReactNode }[] = [
    { id: 'map', label: 'Carte', icon: <MapIcon /> },
    { id: 'settings', label: 'Paramètres', icon: <AdjustmentsIcon /> },
];

const Glass: FunctionComponent<PropsWithChildren<{ className?: string; backgroundColor?: string }>> = ({
    className,
    backgroundColor,
    children,
}) => {
    const { glassmorphismColors } = useHudColor();
    const border = glassmorphismColors.border;

    return (
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
            <div
                className="absolute inset-0"
                style={{ background: backgroundColor ?? glassmorphismColors.background }}
            />
            <div
                className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-transparent"
                style={{
                    background: `linear-gradient(-40deg, ${border}FC 0%, ${border}1A 25%, ${border}1A 75%, ${border}FC 100%) border-box`,
                    WebkitMask: `linear-gradient(${border} 0 0) padding-box, linear-gradient(${border} 0 0) border-box`,
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                }}
            />
            <div className={classNames('relative z-10', className)}>{children}</div>
        </div>
    );
};

const BarButton: FunctionComponent<{ label: string; icon: ReactNode; danger?: boolean; onClick: () => void }> = ({
    label,
    icon,
    danger,
    onClick,
}) => (
    <button
        onClick={onClick}
        className={classNames(
            'flex items-center gap-[0.8vh] rounded-[1vh] px-[1.6vh] py-[0.9vh] text-[1.45vh] font-semibold transition-colors duration-150',
            {
                'bg-white/10 text-white hover:bg-white/25': !danger,
                'bg-red-500/20 text-red-200 hover:bg-red-500/60 hover:text-white': danger,
            }
        )}
    >
        <span className="h-[1.9vh] w-[1.9vh] shrink-0">{icon}</span>
        {label}
    </button>
);

const VolumeSlider: FunctionComponent<{ value: number }> = ({ value }) => {
    const [current, setCurrent] = useState(value);

    useEffect(() => setCurrent(value), [value]);

    const commit = (volume: number) =>
        fetchNui(NuiEvent.PauseMenuSetSetting, { key: 'interfaceVolume', value: volume });

    return (
        <label
            title="Volume des interfaces"
            className="flex items-center gap-[1vh] rounded-[1vh] bg-white/10 px-[1.6vh] py-[0.9vh] text-[1.45vh] font-semibold"
        >
            <span className="h-[1.9vh] w-[1.9vh] shrink-0">{current === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}</span>
            <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={current}
                onChange={event => {
                    const volume = Number(event.currentTarget.value);

                    setCurrent(volume);
                    setVolumes({ master: volume / 100 });
                }}
                onPointerUp={event => commit(Number(event.currentTarget.value))}
                onKeyUp={event => commit(Number(event.currentTarget.value))}
                className="soz-volume-slider w-[14vh]"
                style={{
                    background: `linear-gradient(to right, #fff ${current}%, rgba(255, 255, 255, 0.2) ${current}%)`,
                }}
            />
            <span className="w-[4.4vh] text-right tabular-nums">{current}%</span>
        </label>
    );
};

const TabButton: FunctionComponent<{ label: string; icon: ReactNode; active: boolean; onClick: () => void }> = ({
    label,
    icon,
    active,
    onClick,
}) => (
    <button
        onClick={onClick}
        className={classNames(
            'flex items-center gap-[0.8vh] rounded-[1vh] px-[2vh] py-[1vh] text-[1.7vh] font-semibold transition-colors duration-150',
            {
                'bg-white text-black': active,
                'bg-white/10 text-white/80 hover:bg-white/25 hover:text-white': !active,
            }
        )}
    >
        <span className="h-[2vh] w-[2vh] shrink-0">{icon}</span>
        {label}
    </button>
);

const KeyHint: FunctionComponent<{ label: string }> = ({ label }) => (
    <span className="flex h-[2.4vh] min-w-[2.4vh] items-center justify-center rounded-[0.5vh] bg-white px-[0.6vh] text-[1.15vh] font-bold uppercase text-black shadow-[inset_0_-0.25vh_0_rgba(0,0,0,0.25)]">
        {label}
    </span>
);

const SETTINGS_HINTS: [string, string][] = [
    ['↑↓', 'Déplacer'],
    ['Entrée', 'Valider'],
    ['Échap', 'Retour'],
];

const MAP_HINTS: [string, string][] = [
    ['2× clic', 'Poser un point'],
    ['Échap', 'Retour'],
];

const QuitConfirm: FunctionComponent<{ onCancel: () => void }> = ({ onCancel }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 font-prompt text-white">
        <div className={classNames('w-[46vh]', FOCUS_RING_CLASSES)}>
            <Glass backgroundColor="#000000cc">
                <div className="p-[3vh] text-center">
                    <div className="text-[2.6vh] font-semibold uppercase">Quitter SoZ ?</div>
                    <div className="mt-[1vh] text-[1.6vh] text-white/70">Tu seras déconnecté du serveur.</div>
                    <div className="mt-[3vh] flex justify-center gap-[1.5vh]">
                        <button
                            autoFocus
                            onClick={onCancel}
                            className="rounded-[1vh] bg-white/10 px-[2.5vh] py-[1vh] text-[1.6vh] hover:bg-white/25"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => fetchNui(NuiEvent.PauseMenuQuit)}
                            className="rounded-[1vh] bg-red-500/80 px-[2.5vh] py-[1vh] text-[1.6vh] font-semibold hover:bg-red-500"
                        >
                            Quitter
                        </button>
                    </div>
                </div>
            </Glass>
        </div>
    </div>
);

const FadeIn: FunctionComponent<PropsWithChildren<{ as: 'aside' | 'main'; className: string; instant?: boolean }>> = ({
    as: Tag,
    className,
    instant = false,
    children,
}) => {
    const [shown, setShown] = useState(instant);

    useEffect(() => {
        if (instant) {
            return;
        }

        const handle = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));

        return () => cancelAnimationFrame(handle);
    }, []);

    return (
        <Tag
            {...{ [NAV_ZONE_ATTRIBUTE]: Tag === 'aside' ? 'side' : 'main' }}
            className={classNames(className, FOCUS_RING_CLASSES, {
                'transition-opacity duration-300': !instant,
                'opacity-0': !shown,
            })}
        >
            {children}
        </Tag>
    );
};

export const PauseMenuApp: FunctionComponent = () => {
    const [data, setData] = useState<PauseMenuData | null>(null);
    const [tab, setTab] = useState<PauseMenuTab>('map');
    const customTab = getPauseTabs().find(item => item.id === tab);
    const [confirmQuit, setConfirmQuit] = useState(false);
    const [layers, setLayers] = useState<PauseMapLayer[]>([]);
    const [settingsCategory, setSettingsCategory] = useState('map');
    const mode = useMinimapMode();
    const showContent = mode === 'open';

    const nativeHover = useNativeHover();
    const backdrop = useNativeBackdrop();
    const keyCapture = useKeyCapture();
    const focused = data !== null && keyCapture === 'idle';

    useEffect(() => {
        document.documentElement.classList.toggle('soz-pause-cursor', data !== null);

        return () => document.documentElement.classList.remove('soz-pause-cursor');
    }, [data !== null]);

    useNuiFocus(focused, focused, focused && nativeHover, [], focused && nativeHover);

    useNuiEvent('pause_menu', 'Open', menuData => {
        setConfirmQuit(false);

        if (menuData.scriptMode) {
            setMapTabActive(true);
            setTab('map');
        }

        setLayers(menuData.layers);
        setData(menuData);
    });
    useNuiEvent('pause_menu', 'Close', () => {
        setData(null);
        setNativeHover(false);
    });
    useNuiEvent('pause_menu', 'NativeValue', ({ key, value }) =>
        setData(
            current =>
                current && {
                    ...current,
                    settings: { ...current.settings, native: { ...current.settings.native, [key]: value } },
                }
        )
    );
    useNuiEvent('pause_menu', 'Settings', settings => setData(current => current && { ...current, settings }));

    useEffect(() => {
        setMapTabActive(tab === 'map');
    }, [tab]);

    const close = () => {
        if (!minimapController.requestClose?.()) {
            fetchNui(NuiEvent.PauseMenuClose);
        }
    };

    const changeTab = (direction: number) => {
        if (!data || confirmQuit) {
            return;
        }

        const allTabs = [...TABS, ...getPauseTabs()];
        const index = allTabs.findIndex(item => item.id === tab);

        setTab(allTabs[(index + direction + allTabs.length) % allTabs.length].id);
    };

    useKeyPress('Escape', () => {
        if (!data) {
            return;
        }

        if (confirmQuit) {
            setConfirmQuit(false);
        } else {
            close();
        }
    });
    useKeyPress('p', () => data && !confirmQuit && close());
    useKeyPress('P', () => data && !confirmQuit && close());
    useKeyPress('a', () => changeTab(-1));
    useKeyPress('A', () => changeTab(-1));
    useKeyPress('q', () => changeTab(-1));
    useKeyPress('Q', () => changeTab(-1));
    useKeyPress('e', () => changeTab(1));
    useKeyPress('E', () => changeTab(1));
    useKeyboardNav(data !== null && !confirmQuit);

    if (!data) {
        return null;
    }

    return (
        <div
            className={classNames('absolute inset-0 select-none font-prompt text-white', {
                'opacity-0': keyCapture === 'native',
            })}
        >
            <div
                className={classNames('absolute inset-0 z-[60] transition-opacity duration-300', {
                    'bg-gradient-to-b from-black/50 via-black/25 to-black/50': !data.settings.server.potato,
                    'bg-black': data.settings.server.potato,
                    'opacity-0': mode === 'minimap' || mode === 'closing',
                })}
            />
            <div
                className={classNames('absolute inset-0 z-[60] bg-black transition-opacity duration-[250ms]', {
                    'opacity-0': !backdrop,
                })}
            />
            {showContent &&
                data.scriptMode &&
                createPortal(
                    <button
                        onClick={close}
                        style={{ right: 'max(4vh, calc(50% - 88.89vh + 4vh))' }}
                        className="fixed top-[4vh] z-[90] flex items-center gap-[0.8vh] rounded-[1vh] bg-black/75 px-[2vh] py-[1vh] font-prompt text-[1.5vh] font-semibold uppercase text-white shadow-lg transition-colors hover:bg-red-500/80"
                    >
                        <XIcon className="h-[1.8vh] w-[1.8vh]" />
                        Fermer
                    </button>,
                    document.body
                )}
            {showContent && !data.scriptMode && (
                <div className="pointer-events-none absolute inset-0 z-[75] mx-auto flex max-w-[177.78vh] flex-col gap-[1.8vh] px-[4vh] py-[3vh]">
                    <header className="pointer-events-auto flex h-[5.4vh] shrink-0 items-center gap-[1vh]">
                        <img src="assets/pause/soz_logo.webp" alt="SoZ" className="mr-[2vh] h-[3.6vh] w-auto" />
                        {data.settings.server.potato && (
                            <span title="Mode économe (petit PC) actif" className="-ml-[1.2vh] mr-[1vh] text-amber-300">
                                <ToasterIcon className="h-[2.6vh] w-[2.6vh]" />
                            </span>
                        )}
                        <KeyHint label="Q" />
                        {[...TABS, ...getPauseTabs()].map(item => (
                            <TabButton
                                key={item.id}
                                label={item.label}
                                icon={item.icon}
                                active={tab === item.id}
                                onClick={() => setTab(item.id)}
                            />
                        ))}
                        <KeyHint label="E" />
                        <span className="flex-1" />
                        <div className="flex flex-col items-end leading-tight">
                            <span className="text-[1.5vh] font-bold">
                                {data.firstname} {data.lastname}
                                <span className="ml-[0.6vh] font-normal text-white/50">#{data.serverId}</span>
                            </span>
                            <span className="flex items-center gap-[0.6vh] text-[1.25vh] text-white/60">
                                <span
                                    className={classNames('h-[0.7vh] w-[0.7vh] rounded-full', {
                                        'bg-emerald-400': data.onDuty,
                                        'bg-white/30': !data.onDuty,
                                    })}
                                />
                                {data.job ?? 'Sans emploi'}
                                {data.grade && ` · ${data.grade}`}
                            </span>
                        </div>
                        <BarButton label="Quitter" icon={<LogoutIcon />} danger onClick={() => setConfirmQuit(true)} />
                    </header>

                    <div className="relative flex min-h-0 flex-1 gap-[2.4vh]">
                        {tab === 'map' ? (
                            <FadeIn
                                as="aside"
                                className="pointer-events-auto absolute bottom-[1.6vh] left-[1.6vh] top-[1.6vh] w-[30vh]"
                                instant={!data.settings.server.mapAnimation}
                            >
                                <Glass
                                    backgroundColor="#16171ce6"
                                    className="flex h-full flex-col gap-[1.4vh] p-[1.8vh]"
                                >
                                    <MapSidebar data={data} layers={layers} onLayersChange={setLayers} />
                                </Glass>
                            </FadeIn>
                        ) : customTab ? (
                            <FadeIn
                                as="main"
                                className="pointer-events-auto relative flex min-h-0 min-w-0 flex-1 flex-col"
                                instant={!data.settings.server.mapAnimation}
                            >
                                <customTab.component data={data} />
                            </FadeIn>
                        ) : (
                            <>
                                <FadeIn
                                    as="aside"
                                    className="pointer-events-auto flex w-[24vh] shrink-0 flex-col"
                                    instant={!data.settings.server.mapAnimation}
                                >
                                    <SettingsSidebar
                                        category={settingsCategory}
                                        onCategoryChange={setSettingsCategory}
                                    />
                                </FadeIn>
                                <FadeIn
                                    as="main"
                                    className="pointer-events-auto relative flex min-h-0 min-w-0 flex-1 flex-col"
                                    instant={!data.settings.server.mapAnimation}
                                >
                                    <SettingsMain category={settingsCategory} settings={data.settings} />
                                </FadeIn>
                            </>
                        )}
                    </div>

                    <footer className="pointer-events-auto flex h-[4.6vh] shrink-0 items-center gap-[1vh]">
                        <BarButton label="Reprendre" icon={<PlayIcon />} onClick={close} />
                        <BarButton
                            label="Menu du jeu"
                            icon={<CogIcon />}
                            onClick={() => fetchNui(NuiEvent.PauseMenuOpenNative)}
                        />
                        <VolumeSlider value={Number(data.settings.server.interfaceVolume ?? 100)} />
                        <span className="flex-1" />
                        {(tab === 'map' ? MAP_HINTS : customTab?.hints ?? SETTINGS_HINTS).map(([key, label]) => (
                            <span key={label} className="flex items-center gap-[0.6vh] text-[1.3vh] text-white/60">
                                <KeyHint label={key} />
                                {label}
                            </span>
                        ))}
                    </footer>
                </div>
            )}
            {confirmQuit && createPortal(<QuitConfirm onCancel={() => setConfirmQuit(false)} />, document.body)}
        </div>
    );
};
