import { Transition } from '@headlessui/react';
import { FunctionComponent, useEffect, useState } from 'react';

import { uuidv4 } from '../../../core/utils';
import { CardType, VehicleRegistrationCardData } from '../../../shared/nui/card';
import { PlayerData } from '../../../shared/player';
import { useNuiEvent } from '../../hook/nui';
import { BankCard } from './BankCard';
import { CasinoCard } from './CasinoCard';
import { HealthCard } from './HealthCard';
import { IdentityCard } from './IdentityCard';
import { LicenseCard } from './LicenseCard';
import { VehicleRegistrationCard } from './VehicleRegistrationCard';

type CardData = {
    type: CardType;
    player: PlayerData;
    iban?: string;
};

type CardItemProps = {
    card: CardData;
};

type CardQueueItem = {
    card: CardData;
    id: string;
};

type VehicleRegistrationCardQueueItem = {
    card: VehicleRegistrationCardData;
    id: string;
};

export const CardItem: FunctionComponent<CardItemProps> = ({ card }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        setShow(true);

        setTimeout(() => {
            setShow(false);
        }, 20000);
    }, []);

    let rightOffset = '';
    if (
        (window.innerWidth > 5000 && window.innerHeight < 1500) ||
        (window.innerWidth > 3079 && window.innerHeight < 1200)
    ) {
        rightOffset = 'pr-[94vh]';
    }

    return (
        <Transition
            show={show}
            enter="transform ease-out duration-300 transition"
            enterFrom="-translate-y-full"
            enterTo="translate-y-0"
            leave="transform ease-in duration-300 transition"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
            className={rightOffset}
        >
            {card.type === 'identity' && <IdentityCard player={card.player} />}
            {card.type === 'license' && <LicenseCard player={card.player} />}
            {card.type === 'health' && <HealthCard player={card.player} />}
            {card.type === 'bank' && (
                <BankCard
                    account={card.iban}
                    name={`${card.player.charinfo.firstname} ${card.player.charinfo.lastname}`}
                />
            )}
            {['casino_standard', 'casino_premium'].includes(card.type) && (
                <CasinoCard
                    type={card.type === 'casino_standard' ? 'standard' : 'premium'}
                    expiration={
                        card.type === 'casino_standard'
                            ? card.player.metadata.casino_vip_standard_subscription_expire_at
                            : card.player.metadata.casino_vip_premium_subscription_expire_at
                    }
                    point={card.player.metadata.casino_vip_point ?? 0}
                />
            )}
        </Transition>
    );
};

const VehicleRegistrationCardItem: FunctionComponent<{ card: VehicleRegistrationCardData }> = ({ card }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        setShow(true);

        setTimeout(() => {
            setShow(false);
        }, 20000);
    }, []);

    return (
        <Transition
            show={show}
            enter="transform ease-out duration-300 transition"
            enterFrom="-translate-y-full"
            enterTo="translate-y-0"
            leave="transform ease-in duration-300 transition"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
        >
            <VehicleRegistrationCard {...card} />
        </Transition>
    );
};

export const CardApp: FunctionComponent = () => {
    const [cardQueue, setCardQueue] = useState<CardQueueItem[]>([]);
    const [vehicleRegistrationCardQueue, setVehicleRegistrationCardQueue] = useState<
        VehicleRegistrationCardQueueItem[]
    >([]);

    useNuiEvent('card', 'addCard', card => {
        setCardQueue(prev => [
            {
                card,
                id: uuidv4(),
            },
            ...prev,
        ]);

        setTimeout(() => {
            setCardQueue(prev => {
                const newQueue = [...prev];
                newQueue.pop();
                return newQueue;
            });
        }, 15000);
    });

    useNuiEvent('card', 'addVehicleRegistrationCard', card => {
        setVehicleRegistrationCardQueue(prev => [
            {
                card,
                id: uuidv4(),
            },
            ...prev,
        ]);

        setTimeout(() => {
            setVehicleRegistrationCardQueue(prev => {
                const newQueue = [...prev];
                newQueue.pop();
                return newQueue;
            });
        }, 15000);
    });

    if (cardQueue.length === 0 && vehicleRegistrationCardQueue.length === 0) {
        return null;
    }

    return (
        <div className="absolute w-full h-full">
            <div className="flex flex-column h-full justify-end">
                <div className="h-full overflow-hidden p-6">
                    {cardQueue.map(item => {
                        return <CardItem key={item.id} card={item.card} />;
                    })}
                    {vehicleRegistrationCardQueue.map(item => {
                        return <VehicleRegistrationCardItem key={item.id} card={item.card} />;
                    })}
                </div>
            </div>
        </div>
    );
};
