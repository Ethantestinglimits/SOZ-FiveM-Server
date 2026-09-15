import { FunctionComponent } from 'react';

import { DuoAnimations } from '../../../config/duo-animation';
import { DuoAnimationConfigCategory, DuoAnimationMenuData } from '../../../shared/duo-animation';
import { NuiEvent } from '../../../shared/event';
import { MenuType } from '../../../shared/nui/menu';
import { fetchNui } from '../../fetch';
import { MainMenu, Menu, MenuContent, MenuItemButton, MenuItemSubMenuLink, MenuTitle, SubMenu } from '../Styleguide/Menu';

type MenuDuoAnimationProps = {
    data: DuoAnimationMenuData;
};

const categories = DuoAnimations.filter(
    (item): item is DuoAnimationConfigCategory => item.type === 'category'
);

export const MenuDuoAnimation: FunctionComponent<MenuDuoAnimationProps> = ({ data }) => {
    return (
        <Menu type={MenuType.DuoAnimation}>
            <MainMenu>
                <MenuTitle title="Animation" />
                <MenuContent subtitle="Proposer une animation">
                    {categories.map((category, index) => (
                        <MenuItemSubMenuLink id={`duo_animation_category_${index}`} key={index}>
                            {category.name}
                        </MenuItemSubMenuLink>
                    ))}
                </MenuContent>
            </MainMenu>
            {categories.map((category, index) => (
                <SubMenu id={`duo_animation_category_${index}`} key={index}>
                    <MenuTitle title="Animation" />
                    <MenuContent subtitle={category.name}>
                        {category.items.map(item => {
                            if (item.type !== 'animation') {
                                return null;
                            }

                            return (
                                <MenuItemButton
                                    key={item.animation.id}
                                    onConfirm={() => {
                                        fetchNui(NuiEvent.PlayerMenuDuoAnimationRequest, {
                                            targetServerId: data.targetServerId,
                                            animationId: item.animation.id,
                                        });
                                    }}
                                >
                                    {item.animation.label}
                                </MenuItemButton>
                            );
                        })}
                    </MenuContent>
                </SubMenu>
            ))}
        </Menu>
    );
};
