import { FunctionComponent } from 'react';

import { VehicleRegistrationCardData } from '../../../shared/nui/card';

export const VehicleRegistrationCard: FunctionComponent<VehicleRegistrationCardData> = ({
    plate,
    vehicleModel,
    ownerName,
}) => {
    return (
        <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-400/40 rounded-lg aspect-[855/539] h-[340px] p-6 text-white flex flex-col justify-between">
            <div>
                <h2 className="text-xs uppercase tracking-widest text-blue-300">Certificat d'immatriculation</h2>
                <div className="mt-4">
                    <h3 className="text-xs leading-none text-blue-300">Immatriculation</h3>
                    <p className="uppercase leading-tight text-2xl font-bold">{plate}</p>
                </div>
            </div>
            <div>
                <h3 className="text-xs leading-none text-blue-300">Modèle</h3>
                <p className="uppercase leading-tight text-lg">{vehicleModel}</p>
            </div>
            <div>
                <h3 className="text-xs leading-none text-blue-300">Titulaire</h3>
                <p className="uppercase leading-tight text-lg">{ownerName}</p>
            </div>
        </div>
    );
};
