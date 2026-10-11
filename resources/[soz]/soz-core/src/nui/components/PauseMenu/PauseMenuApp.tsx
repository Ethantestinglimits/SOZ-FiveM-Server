import { CogIcon, LogoutIcon, PlayIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, PropsWithChildren, ReactNode, useEffect, useMemo, useState } from 'react';

import { Postals } from '../../../config/postals';
import { NuiEvent } from '../../../shared/event';
import { PauseMapPoint, PauseMapSettings, PauseMenuData } from '../../../shared/nui/pause_menu';
import { fetchNui } from '../../fetch';
import { useKeyPress } from '../../hook/control';
import { useNuiEvent, useNuiFocus } from '../../hook/nui';
import { GlassMorphismContainer } from '../Styleguide/GlassMorphismContainer';
import { PauseMap, PauseMapFocus } from './PauseMap';
import { PauseMapLegend } from './PauseMapLegend';
import { preloadPauseMap } from './pauseMapRenderer';
import { PauseMapSearch, PauseMapSearchResult } from './PauseMapSearch';

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

const QuitConfirm: FunctionComponent<{ onCancel: () => void }> = ({ onCancel }) => (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/50">
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

export const PauseMenuApp: FunctionComponent = () => {
    const [data, setData] = useState<PauseMenuData | null>(null);
    const [confirmQuit, setConfirmQuit] = useState(false);
    const [focusRequest, setFocusRequest] = useState<PauseMapFocus | null>(null);

    useNuiFocus(data !== null, data !== null, false);

    useEffect(() => {
        preloadPauseMap();
    }, []);

    useNuiEvent('pause_menu', 'Open', (menuData) => {
        setConfirmQuit(false);
        setFocusRequest(null);
        setData(menuData);
    });
    useNuiEvent('pause_menu', 'Close', () => setData(null));

    const close = () => fetchNui(NuiEvent.PauseMenuClose);
    const openMap = () => fetchNui(NuiEvent.PauseMenuOpenMap);

    const focus = (point: PauseMapPoint) => {
        setFocusRequest((current) => ({ x: point.x, y: point.y, id: (current?.id ?? 0) + 1 }));
    };

    const onSettingsChange = (settings: PauseMapSettings) => {
        setData((current) => current && { ...current, settings });
        fetchNui(NuiEvent.PauseMenuSaveMapSettings, settings);
    };

    const searchItems = useMemo<PauseMapSearchResult[]>(() => {
        if (!data) {
            return [];
        }

        return [
            ...Postals.map(([code, x, y]) => ({ id: `postal-${code}`, label: code, type: 'Code postal', x, y })),
            ...data.regions.map((region, index) => ({
                id: `region-${index}`,
                label: region.name,
                type: 'Région',
                x: region.x,
                y: region.y,
            })),
            ...data.blips
                .filter((blip) => blip.name)
                .map((blip) => ({ id: `blip-${blip.id}`, label: blip.name, type: 'Lieu', x: blip.x, y: blip.y })),
        ];
    }, [data?.regions, data?.blips]);

    const onSearchSelect = (result: PauseMapSearchResult) => {
        focus(result);
        fetchNui(NuiEvent.PauseMenuSetWaypoint, { x: result.x, y: result.y });
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

    if (!data) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-[60] flex select-none gap-[2vh] bg-gradient-to-b from-black/50 via-black/25 to-black/50 p-[3vh] font-prompt text-white">
            <aside className="w-[17vw] shrink-0">
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

                    <PauseMapSearch items={searchItems} onSelect={onSearchSelect} />

                    <PauseMapLegend blips={data.blips} onFocus={focus} />

                    <div className="flex flex-col gap-[0.8vh]">
                        <SideButton label="Reprendre" icon={<PlayIcon />} onClick={close} />
                        <SideButton
                            label="Menu du jeu"
                            icon={<CogIcon />}
                            onClick={() => fetchNui(NuiEvent.PauseMenuOpenSettings)}
                        />
                        <SideButton label="Quitter" icon={<LogoutIcon />} danger onClick={() => setConfirmQuit(true)} />
                    </div>
                </Glass>
            </aside>
            <main className="min-h-0 min-w-0 flex-1">
                <PauseMap
                    player={data.player}
                    waypoint={data.waypoint}
                    route={data.route}
                    blips={data.blips}
                    zones={data.zones}
                    regions={data.regions}
                    settings={data.settings}
                    onSettingsChange={onSettingsChange}
                    onOpenNativeMap={openMap}
                    focusRequest={focusRequest}
                />
            </main>
            {confirmQuit && <QuitConfirm onCancel={() => setConfirmQuit(false)} />}
        </div>
    );
};
