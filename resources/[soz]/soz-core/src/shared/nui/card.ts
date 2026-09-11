import { PlayerData } from '../player';

export interface NuiCardMethodMap {
    addCard: CardData;
    addVehicleRegistrationCard: VehicleRegistrationCardData;
}

export type CardData = {
    type: CardType;
    player: PlayerData;
    iban?: string;
    expiration?: number;
};

export type CardType = 'identity' | 'license' | 'health' | 'bank' | 'casino_standard' | 'casino_premium';

export type VehicleRegistrationCardData = {
    plate: string;
    vehicleModel: string;
    ownerName: string;
};
