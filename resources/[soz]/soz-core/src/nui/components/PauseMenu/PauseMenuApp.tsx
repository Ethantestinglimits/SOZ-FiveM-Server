import { AdjustmentsIcon, CogIcon, LogoutIcon, MapIcon, PlayIcon, XIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { NuiEvent } from '../../../shared/event';
import { PauseMapLayer, PauseMenuData } from '../../../shared/nui/pause_menu';
import { fetchNui } from '../../fetch';
import { useKeyPress } from '../../hook/control';
import { useNuiEvent, useNuiFocus } from '../../hook/nui';
import { minimapController, setMapTabActive, useMinimapMode } from '../Minimap/minimapState';
import { GlassMorphismContainer } from '../Styleguide/GlassMorphismContainer';
import { MapSidebar } from './MapSidebar';
import { SettingsMain, SettingsSidebar } from './settings/SettingsView';

type PauseMenuTab = 'map' | 'settings';

const TABS: { id: PauseMenuTab; label: string; icon: ReactNode }[] = [
    { id: 'map', label: 'Carte', icon: <MapIcon /> },
    { id: 'settings', label: 'Paramètres', icon: <AdjustmentsIcon /> },
];

const Glass: FunctionComponent<PropsWithChildren<{ className?: string; backgroundColor?: string }>> = ({
    className,
    backgroundColor,
    children,
}) => (
    <GlassMorphismContainer
        cantBeHidden
        rounded={16}
        borderClassName="rounded-2xl"
        backgroundColor={backgroundColor}
        className={className}
    >
        {children}
    </GlassMorphismContainer>
);

type SideButtonProps = {
    label: string;
    icon: ReactNode;
    danger?: boolean;
    onClick: () => void;
};

const SideButton: FunctionComponent<SideButtonProps> = ({ label, icon, danger, onClick }) => (
    <button
        onClick={onClick}
        className={classNames(
            'flex w-full items-center gap-[1vh] rounded-[1vh] px-[1.4vh] py-[1vh] text-left text-[1.5vh] font-semibold uppercase transition-colors duration-150',
            {
                'bg-white/10 text-white hover:bg-white/25': !danger,
                'bg-red-500/20 text-red-200 hover:bg-red-500/60 hover:text-white': danger,
            },
        )}
    >
        <span className="h-[2vh] w-[2vh] shrink-0">{icon}</span>
        {label}
    </button>
);

const TabButton: FunctionComponent<{ label: string; icon: ReactNode; active: boolean; onClick: () => void }> = ({
    label,
    icon,
    active,
    onClick,
}) => (
    <button
        onClick={onClick}
        className={classNames(
            'flex flex-1 items-center justify-center gap-[0.8vh] rounded-[1vh] px-[1vh] py-[0.9vh] text-[1.4vh] font-semibold uppercase transition-colors duration-150',
            {
                'bg-white text-black': active,
                'bg-white/10 text-white/80 hover:bg-white/25 hover:text-white': !active,
            },
        )}
    >
        <span className="h-[1.8vh] w-[1.8vh] shrink-0">{icon}</span>
        {label}
    </button>
);

const QuitConfirm: FunctionComponent<{ onCancel: () => void }> = ({ onCancel }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 font-prompt text-white">
        <div className="w-[26vw]">
            <Glass backgroundColor="#000000cc">
                <div className="p-[3vh] text-center">
                    <div className="text-[2.6vh] font-semibold uppercase">Quitter SoZ ?</div>
                    <div className="mt-[1vh] text-[1.6vh] text-white/70">Tu seras déconnecté du serveur.</div>
                    <div className="mt-[3vh] flex justify-center gap-[1.5vh]">
                        <button
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
        <Tag className={classNames(className, { 'transition-opacity duration-300': !instant, 'opacity-0': !shown })}>
            {children}
        </Tag>
    );
};

export const PauseMenuApp: FunctionComponent = () => {
    const [data, setData] = useState<PauseMenuData | null>(null);
    const [tab, setTab] = useState<PauseMenuTab>('map');
    const [confirmQuit, setConfirmQuit] = useState(false);
    const [layers, setLayers] = useState<PauseMapLayer[]>([]);
    const [settingsCategory, setSettingsCategory] = useState('map');
    const [nativeBusy, setNativeBusy] = useState(false);
    const mode = useMinimapMode();
    const showContent = mode === 'open';

    useNuiFocus(data !== null, data !== null, false);

    useNuiEvent('pause_menu', 'Open', (menuData) => {
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
        setNativeBusy(false);
    });
    useNuiEvent('pause_menu', 'NativeBusy', setNativeBusy);
    useNuiEvent('pause_menu', 'Settings', (settings) => setData((current) => current && { ...current, settings }));

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

        const index = TABS.findIndex((item) => item.id === tab);

        setTab(TABS[(index + direction + TABS.length) % TABS.length].id);
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
    useKeyPress('e', () => changeTab(1));
    useKeyPress('E', () => changeTab(1));

    if (!data) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-[60] flex select-none gap-[2vh] p-[3vh] font-prompt text-white">
            <div
                className={classNames('absolute inset-0 transition-opacity duration-300', {
                    'bg-gradient-to-b from-black/50 via-black/25 to-black/50': !data.settings.server.potato,
                    'bg-black': data.settings.server.potato,
                    'opacity-0': mode === 'minimap' || mode === 'closing',
                })}
            />
            {showContent &&
                data.scriptMode &&
                createPortal(
                    <button
                        onClick={close}
                        className="fixed right-[4vh] top-[4vh] z-[90] flex items-center gap-[0.8vh] rounded-[1vh] bg-black/75 px-[2vh] py-[1vh] font-prompt text-[1.5vh] font-semibold uppercase text-white shadow-lg transition-colors hover:bg-red-500/80"
                    >
                        <XIcon className="h-[1.8vh] w-[1.8vh]" />
                        Fermer
                    </button>,
                    document.body,
                )}
            {showContent && !data.scriptMode && (
                <FadeIn as="aside" className="relative w-[17vw] shrink-0" instant={!data.settings.server.mapAnimation}>
                    <Glass className="flex h-full flex-col gap-[2vh] p-[2.5vh]">
                        <img src="assets/pause/soz_logo.webp" alt="SoZ" className="h-[4vh] w-auto self-start" />

                        <div className="flex flex-col gap-[0.4vh]">
                            <div className="flex items-baseline justify-between gap-[1vh]">
                                <span className="truncate text-[2vh] font-bold leading-tight">
                                    {data.firstname} {data.lastname}
                                </span>
                                <span className="shrink-0 text-[1.3vh] text-white/50">#{data.serverId}</span>
                            </div>
                            <div className="flex items-center gap-[0.8vh] text-[1.4vh] text-white/70">
                                <span
                                    className={classNames('h-[0.8vh] w-[0.8vh] shrink-0 rounded-full', {
                                        'bg-emerald-400': data.onDuty,
                                        'bg-white/30': !data.onDuty,
                                    })}
                                />
                                <span className="truncate">
                                    {data.job ?? 'Sans emploi'}
                                    {data.grade && ` · ${data.grade}`}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-[0.8vh]">
                            {TABS.map((item) => (
                                <TabButton
                                    key={item.id}
                                    label={item.label}
                                    icon={item.icon}
                                    active={tab === item.id}
                                    onClick={() => setTab(item.id)}
                                />
                            ))}
                        </div>

                        {tab === 'map' ? (
                            <MapSidebar data={data} layers={layers} onLayersChange={setLayers} />
                        ) : (
                            <SettingsSidebar category={settingsCategory} onCategoryChange={setSettingsCategory} />
                        )}

                        <div className="flex flex-col gap-[0.8vh]">
                            <SideButton label="Reprendre" icon={<PlayIcon />} onClick={close} />
                            <SideButton
                                label="Menu du jeu"
                                icon={<CogIcon />}
                                onClick={() => fetchNui(NuiEvent.PauseMenuOpenNative)}
                            />
                            <SideButton
                                label="Quitter"
                                icon={<LogoutIcon />}
                                danger
                                onClick={() => setConfirmQuit(true)}
                            />
                        </div>
                    </Glass>
                </FadeIn>
            )}
            {showContent && !data.scriptMode && (
                <FadeIn
                    as="main"
                    className="relative min-h-0 min-w-0 flex-1"
                    instant={!data.settings.server.mapAnimation}
                >
                    {tab === 'settings' && (
                        <Glass className="h-full">
                            <SettingsMain category={settingsCategory} settings={data.settings} />
                        </Glass>
                    )}
                </FadeIn>
            )}
            {confirmQuit && createPortal(<QuitConfirm onCancel={() => setConfirmQuit(false)} />, document.body)}
            {nativeBusy &&
                createPortal(
                    <div className="fixed inset-0 z-[300] flex cursor-wait items-end justify-center pb-[6vh] font-prompt text-[1.6vh] text-white/80">
                        <span className="rounded-[1vh] bg-black/70 px-[1.6vh] py-[0.8vh]">Application du réglage…</span>
                    </div>,
                    document.body,
                )}
        </div>
    );
};
