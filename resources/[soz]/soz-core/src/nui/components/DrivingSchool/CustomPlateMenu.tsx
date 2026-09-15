import { NuiEvent } from '@public/shared/event';
import { MenuType } from '@public/shared/nui/menu';
import { CustomPlateMenuData } from '@public/shared/vehicle/plate';
import { FunctionComponent } from 'react';

import { fetchNui } from '../../fetch';
import { MainMenu, Menu, MenuContent, MenuItemButton, MenuSubTitle, MenuTitle } from '../Styleguide/Menu';

type CustomPlateMenuProps = {
    data?: CustomPlateMenuData;
};

export const CustomPlateMenu: FunctionComponent<CustomPlateMenuProps> = ({ data }) => {
    const vehicles = data?.vehicles ?? [];

    const chooseVehicle = (id: number, price: number) => {
        fetchNui(NuiEvent.CustomPlateChooseVehicle, { id, price });
    };

    return (
        <Menu type={MenuType.CustomPlate}>
            <MainMenu>
                <MenuTitle title="Plaques personnalisées" />
                <MenuContent subtitle="Choisissez le véhicule à personnaliser">
                    {vehicles.length === 0 && <MenuSubTitle>Vous ne possédez aucun véhicule éligible.</MenuSubTitle>}
                    {vehicles.map(vehicle => (
                        <MenuItemButton key={vehicle.id} onConfirm={() => chooseVehicle(vehicle.id, vehicle.price)}>
                            <div className="flex w-full justify-between items-center">
                                <span>
                                    {vehicle.label} ({vehicle.plate})
                                </span>
                                <span>${vehicle.price.toLocaleString('fr-FR')}</span>
                            </div>
                        </MenuItemButton>
                    ))}
                </MenuContent>
            </MainMenu>
        </Menu>
    );
};
