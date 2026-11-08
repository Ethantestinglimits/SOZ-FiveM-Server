import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useEffect, useMemo, useState } from 'react';

import { HUD_ELEMENTS } from '../../../../../shared/nui/hud_layout';
import { store } from '../../../../store';
import { getScreenFrame } from '../../../../utils/screenFrame';
import { setHudEditing, setHudPreview } from '../../../Hud/hudPreview';
import { minimapController } from '../../../Minimap/minimapState';
import { openPauseTab } from '../../pauseTabs';
import { ToggleButton } from '../../settings/rowControls';

type Situation = {
    vehicle: boolean;
    weapon: boolean;
    watch: boolean;
    minimapHidden: boolean;
    notification: boolean;
    police: boolean;
    progress: boolean;
    instructions: boolean;
};

const SITUATIONS: { id: keyof Situation; label: string }[] = [
    { id: 'vehicle', label: 'En véhicule' },
    { id: 'weapon', label: 'Arme en main' },
    { id: 'watch', label: 'Smartwatch' },
    { id: 'minimapHidden', label: 'Minimap cachée' },
    { id: 'notification', label: 'Notification' },
    { id: 'police', label: 'Alerte police' },
    { id: 'progress', label: 'Barre de progression' },
    { id: 'instructions', label: 'Aide' },
];

const NOTIFICATION_ID = 'hud-editor-notification';
const POLICE_ID = 'hud-editor-police';
const LONG_DELAY = 3600000;

const send = (app: string, method: string, data?: unknown): void => {
    window.postMessage({ app, method, data }, '*');
};

const initialSituation = (): Situation => {
    const state = store.getState();

    return {
        vehicle: state.vehicle.seat !== null && state.vehicle.seat !== undefined,
        weapon: Boolean(state.hud.ammo?.hasWeapon),
        watch: Boolean(state.hud.hasWatch),
        minimapHidden: Boolean(state.hud.minimap?.isHidden),
        notification: false,
        police: false,
        progress: false,
        instructions: false,
    };
};

const Section: FunctionComponent<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <div className="flex flex-col gap-[0.6vh]">
        <span className="text-[1.1vh] font-semibold uppercase tracking-[0.2em] text-white/45">{title}</span>
        {children}
    </div>
);

export const HudEditorTab: FunctionComponent = () => {
    const [situation, setSituation] = useState<Situation>(initialSituation);
    const [collapsed, setCollapsed] = useState(false);
    const frame = useMemo(() => getScreenFrame(), []);

    useEffect(() => {
        setHudPreview({
            hud: {
                hasWatch: () => situation.watch,
                ammo: real => ({
                    ammo: 24,
                    maxAmmo: 120,
                    ...(real as object),
                    hasWeapon: situation.weapon,
                }),
                minimap: real => ({ ...(real as object), isHidden: situation.minimapHidden }),
            },
            vehicle: {
                seat: () => (situation.vehicle ? -1 : null),
            },
        });
        minimapController.renderer?.preview(!situation.minimapHidden);
    }, [situation.watch, situation.weapon, situation.minimapHidden, situation.vehicle]);

    useEffect(() => {
        if (situation.notification) {
            send('hud', 'DrawNotification', {
                id: NOTIFICATION_ID,
                message: 'Exemple de notification pour placer le bloc.',
                style: 'info',
                delay: LONG_DELAY,
            });
        } else {
            send('hud', 'CancelNotification', NOTIFICATION_ID);
        }
    }, [situation.notification]);

    useEffect(() => {
        if (situation.police) {
            send('hud', 'DrawNotification', {
                id: POLICE_ID,
                message: 'Exemple d’alerte police.',
                style: 'info',
                delay: LONG_DELAY,
                title: 'Central',
                policeStyle: 'default',
                hour: '12:00',
                logo: 'lspd',
                notificationId: 0,
            });
        } else {
            send('hud', 'CancelNotification', POLICE_ID);
        }
    }, [situation.police]);

    useEffect(() => {
        if (situation.progress) {
            send('progress', 'Start', { label: 'Exemple de progression', duration: LONG_DELAY, units: [] });
        } else {
            send('progress', 'Stop');
        }
    }, [situation.progress]);

    useEffect(() => {
        send('hud', 'SetInstructional', situation.instructions ? ['~INPUT_CONTEXT~ Exemple d’aide'] : []);
        send('hud', 'ForceDisplayInstructional', situation.instructions);
    }, [situation.instructions]);

    useEffect(() => {
        setHudEditing(true);
    }, []);

    useEffect(
        () => () => {
            setHudEditing(false);
            setHudPreview(null);
            minimapController.renderer?.preview(null);
            send('hud', 'CancelNotification', NOTIFICATION_ID);
            send('hud', 'CancelNotification', POLICE_ID);
            send('progress', 'Stop');
            send('hud', 'SetInstructional', []);
            send('hud', 'ForceDisplayInstructional', false);
        },
        []
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopImmediatePropagation();
                openPauseTab('settings');
            }
        };

        window.addEventListener('keydown', onKeyDown, true);

        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, []);

    return (
        <div className="absolute inset-0 font-prompt text-white">
            <div
                className="pointer-events-none absolute inset-y-0 border-x-2 border-dashed border-white/25"
                style={{ left: frame.x, width: frame.w }}
            />

            <aside
                className={classNames(
                    'pointer-events-auto absolute left-[2vh] top-[2vh] flex max-h-[calc(100%-4vh)] flex-col gap-[1.6vh] rounded-2xl bg-[#16171ce6] p-[1.8vh] shadow-xl transition-all duration-200',
                    { 'w-[30vh]': !collapsed, 'w-auto': collapsed }
                )}
            >
                <div className="flex items-center gap-[1vh]">
                    {!collapsed && <span className="flex-1 text-[1.7vh] font-bold">Éditeur d’ATH</span>}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="h-[3vh] w-[3vh] rounded-[0.6vh] bg-white/10 p-[0.5vh] hover:bg-white/25"
                    >
                        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </button>
                </div>

                {!collapsed && (
                    <div className="flex min-h-0 flex-col gap-[2vh] overflow-y-auto pr-[0.4vh] scrollbar scrollbar-w-[4px] scrollbar-thumb-white/40 scrollbar-thumb-rounded-full">
                        <Section title="Situation">
                            {SITUATIONS.map(item => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between rounded-[0.8vh] bg-white/5 px-[1.2vh] py-[0.6vh] text-[1.35vh] font-semibold"
                                >
                                    {item.label}
                                    <ToggleButton
                                        value={situation[item.id]}
                                        onPress={() => setSituation({ ...situation, [item.id]: !situation[item.id] })}
                                    />
                                </div>
                            ))}
                        </Section>

                        <Section title="Blocs">
                            {HUD_ELEMENTS.filter(element => !element.welded).map(element => (
                                <div
                                    key={element.id}
                                    className={classNames(
                                        'rounded-[0.8vh] bg-white/5 px-[1.2vh] py-[0.7vh] text-[1.35vh] font-semibold',
                                        { 'opacity-50': element.watch && !situation.watch }
                                    )}
                                >
                                    {element.label}
                                    {element.watch && !situation.watch && (
                                        <span className="ml-[0.8vh] text-[1.15vh] font-normal text-white/70">
                                            pas de smartwatch
                                        </span>
                                    )}
                                </div>
                            ))}
                        </Section>

                        <button
                            onClick={() => openPauseTab('settings')}
                            className="flex items-center justify-center gap-[0.8vh] rounded-[0.8vh] bg-white/10 py-[0.9vh] text-[1.4vh] font-semibold hover:bg-white/25"
                        >
                            <XIcon className="h-[1.8vh] w-[1.8vh]" />
                            Quitter l’éditeur
                        </button>
                    </div>
                )}
            </aside>
        </div>
    );
};
