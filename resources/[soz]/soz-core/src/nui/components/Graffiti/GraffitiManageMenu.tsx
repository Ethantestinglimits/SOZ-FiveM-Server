import { GraffitiMenuData } from '@public/shared/graffiti';
import { MenuType } from '@public/shared/nui/menu';
import { FunctionComponent } from 'react';

import { NuiEvent } from '../../../shared/event/nui';
import { fetchNui } from '../../fetch';
import { MainMenu, Menu, MenuContent, MenuItemButton, MenuItemText, MenuTitle } from '../Styleguide/Menu';

type GraffitiManageMenuProps = {
    data?: GraffitiMenuData;
};

export const GraffitiManageMenu: FunctionComponent<GraffitiManageMenuProps> = ({ data }) => {
    if (!data) {
        return null;
    }

    return (
        <Menu type={MenuType.GraffitiManageMenu}>
            <MainMenu>
                <MenuTitle title="Graffitis du gang" />
                <MenuContent>
                    {data.tags.length === 0 && <MenuItemText>Votre gang n'a aucun tag posé.</MenuItemText>}
                    {data.tags.map((tag, index) => (
                        <MenuItemButton
                            onConfirm={() => fetchNui(NuiEvent.GraffitiManageRemove, { id: tag.id })}
                            description={`${tag.distanceLabel} - ${tag.hasImage ? 'peint' : 'vide'}`}
                            key={tag.id}
                        >
                            Tag #{index + 1}
                        </MenuItemButton>
                    ))}
                </MenuContent>
            </MainMenu>
        </Menu>
    );
};
