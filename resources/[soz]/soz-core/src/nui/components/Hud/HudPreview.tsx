import { init } from '@rematch/core';
import { FunctionComponent, useMemo } from 'react';
import { Provider } from 'react-redux';

import { PlayerData } from '../../../shared/player';
import { HudElementId } from '../../../shared/nui/hud_layout';
import { Progress } from '../../../shared/nui/progress';
import { AdvancedNotification, BasicNotification, TPoliceNotification } from '../../../shared/notification';
import { VehicleLightState, VehicleLockStatus } from '../../../shared/vehicle/vehicle';
import { useMinimap } from '../../hook/data';
import { models } from '../../models';
import { store } from '../../store';
import { ProgressContent } from '../Progress/ProgressApp';
import { PetStats } from './components/PetStats';
import { PlayerStats } from './components/PlayerStats';
import { InstructionalContent } from './InstructionalOverlay';
import { Notification, PoliceNotification } from './Notifications';
import { VehicleContent } from './VehicleInterface';
import { AmmoContent } from './WeaponInterface';

const PREVIEW_DELAY = 60 * 60 * 1000;

const NOTIFICATIONS: (BasicNotification | AdvancedNotification)[] = [
    { id: 'preview-success', message: 'Exemple de notification', style: 'success', delay: PREVIEW_DELAY },
    { id: 'preview-info', message: 'Une autre notification', style: 'info', delay: PREVIEW_DELAY },
];

const POLICE_NOTIFICATION: TPoliceNotification = {
    id: 'preview-police',
    title: 'Braquage',
    message: 'Un {class}braquage{/class} est en cours',
    style: 'info',
    delay: PREVIEW_DELAY,
    policeStyle: 'robbery',
    hour: '12:00',
    logo: 'lspd',
    notificationId: 1234,
};

const INSTRUCTIONS = ['b_2000', 'Valider', 'b_1074', 'Annuler'];

const PROGRESS: Progress = {
    label: 'Action en cours',
    duration: 10000,
    units: [],
};

const noop = () => {};

const createPreviewStore = () => {
    const state = store.getState();
    const player = state.player;

    return init({
        models,
        redux: {
            initialState: {
                ...state,
                player: {
                    ...player,
                    metadata: {
                        ...player?.metadata,
                        isdead: false,
                        max_health: 200,
                        hunger: 35,
                        thirst: 40,
                        alcohol: 25,
                        drug: 0,
                        stress_level: 40,
                    },
                } as PlayerData,
                playerStats: { health: 150, armor: 60, stamina: 60, armorPlates: 0 },
                petStats: null,
                vehicle: {
                    ...state.vehicle,
                    seat: -1,
                    seatbelt: false,
                    lockStatus: VehicleLockStatus.Unlocked,
                    lightState: VehicleLightState.LowBeam,
                    fuelType: 'essence' as const,
                    fuelLevel: 62,
                    maxFuel: 100,
                    useRpm: false,
                    nosCount: 0,
                    nosLevel: 0,
                },
                vehicleSpeed: { speed: 87, rpm: 0.4, gear: 3 },
            },
        },
    });
};

type HudPreviewProps = {
    id: HudElementId;
};

export const HudPreview: FunctionComponent<HudPreviewProps> = ({ id }) => {
    const minimap = useMinimap();
    const previewStore = useMemo(createPreviewStore, []);

    return (
        <Provider store={previewStore}>
            <HudPreviewContent id={id} width={minimap.width} />
        </Provider>
    );
};

const HudPreviewContent: FunctionComponent<{ id: HudElementId; width: number }> = ({ id, width }) => {
    switch (id) {
        case 'notifications':
            return (
                <div className="flex flex-col-reverse gap-4" style={{ width: `${width * 100}vw` }}>
                    {NOTIFICATIONS.map((notification) => (
                        <Notification key={notification.id} notification={notification} onDelete={noop} />
                    ))}
                </div>
            );
        case 'police':
            return (
                <div style={{ width: `${width * 150}vw` }}>
                    <PoliceNotification notification={POLICE_NOTIFICATION} onDelete={noop} />
                </div>
            );
        case 'instructions':
            return (
                <div className="h-10 w-fit">
                    <InstructionalContent text={INSTRUCTIONS} />
                </div>
            );
        case 'ammo':
            return (
                <div className="flex gap-1 items-center justify-center text-white w-fit drop-shadow-bg">
                    <AmmoContent ammo={24} maxAmmo={120} />
                </div>
            );
        case 'stats':
            return (
                <div className="flex gap-3 text-white h-fit">
                    <PlayerStats />
                    <PetStats />
                </div>
            );
        case 'vehicle':
            return (
                <div className="flex justify-center gap-3">
                    <VehicleContent isPilot />
                </div>
            );
        case 'progress':
            return (
                <div className="flex flex-col justify-center items-center gap-3 text-white text-xl w-fit">
                    <ProgressContent progress={PROGRESS} currentProgress={0.6} inVehicle={false} />
                </div>
            );
        default:
            return null;
    }
};
