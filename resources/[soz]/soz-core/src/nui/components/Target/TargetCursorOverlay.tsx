import cn from 'classnames';
import { FunctionComponent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ContextMenuGroupIcons } from '../../../config/context-menu';
import { NuiEvent } from '../../../shared/event/nui';
import { TargetCursorMenuPosition } from '../../../shared/nui/target';
import { TargetOption } from '../../../shared/target';
import { fetchNui } from '../../fetch';
import { useAssetPath } from '../../hook/assets';
import { useNuiFocus } from '../../hook/nui';
import { useHudColor } from '../Hud/hooks/useHudColor';
import { GlassMorphismContainer } from '../Styleguide/GlassMorphismContainer';

type TargetCursorOverlayProps = {
    active: boolean;
    hover: boolean;
    menu: TargetCursorMenuPosition | null;
    targets: TargetOption[];
};

const CATEGORIES = [
    { id: 'citizen', title: 'Actions' },
    { id: 'society', title: 'Entreprise' },
    { id: 'criminal', title: 'Criminelle' },
] as const;

// Largeurs (en rem) du menu principal, du sous-menu et de l'espace entre les deux
const MENU_WIDTH = 18;
const SUB_MENU_WIDTH = 16;
const SUB_MENU_GAP = 0.5;

// "Admin/Véhicule" = sous-menu "Véhicule" du sous-menu "Admin"
const getGroupPath = (target: TargetOption): string[] => (target.group ? target.group.split('/') : []);

// Contenu d'un panneau: options directes (groupe == préfixe) et sous-groupes, dans l'ordre d'apparition
const getPanelContent = (targets: TargetOption[], prefix: string[]) => {
    const direct: TargetOption[] = [];
    const children: string[] = [];

    for (const target of targets) {
        const path = getGroupPath(target);

        if (!prefix.every((segment, index) => path[index] === segment)) continue;

        if (path.length === prefix.length) {
            direct.push(target);
        } else if (!children.includes(path[prefix.length])) {
            children.push(path[prefix.length]);
        }
    }

    return { direct, children };
};

// Chemin réellement affiché: les sous-menus qui n'existent plus après un rafraîchissement sont retirés, et un panneau
// sans option directe qui n'a qu'un seul sous-menu l'ouvre d'office (évite un clic inutile)
const resolvePath = (targets: TargetOption[], requested: string[]): string[] => {
    const path: string[] = [];

    for (const segment of requested) {
        if (!getPanelContent(targets, path).children.includes(segment)) break;

        path.push(segment);
    }

    for (;;) {
        const { direct, children } = getPanelContent(targets, path);

        if (direct.length > 0 || children.length !== 1) break;

        path.push(children[0]);
    }

    return path;
};

type TargetCursorRowProps = {
    label: string;
    subLabel?: string;
    icon?: string;
    // Sous-menu uniquement: teinte le fond derrière l'icône pour le distinguer (l'image elle-même n'est pas recolorée)
    iconColor?: string;
    checked?: boolean;
    chevron?: 'right';
    active?: boolean;
    onSelect: () => void;
};

const TargetCursorRow: FunctionComponent<TargetCursorRowProps> = ({
    label,
    subLabel,
    icon,
    iconColor,
    checked,
    chevron,
    active,
    onSelect,
}) => {
    const { getPath } = useAssetPath();

    return (
        <div
            className={cn('flex h-8 cursor-pointer items-center gap-2 px-3 hover:bg-white/15', {
                'bg-white/15': active,
            })}
            onClick={onSelect}
            onAuxClick={onSelect}
        >
            {icon && iconColor && (
                <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${iconColor}26`, boxShadow: `inset 0 0 0 1px ${iconColor}66` }}
                >
                    <img className="size-4" src={getPath(`images/target/${icon}.webp`)} alt="" />
                </span>
            )}
            {icon && !iconColor && (
                <img className="size-5 shrink-0" src={getPath(`images/target/${icon}.webp`)} alt="" />
            )}
            <span className="flex-1 truncate text-sm">{label}</span>
            {subLabel && <span className="shrink-0 text-xs opacity-70">{subLabel}</span>}
            {chevron === 'right' && <span className="shrink-0 text-sm opacity-70">›</span>}
            {checked !== undefined && (
                <span
                    className={cn('relative h-4 w-7 shrink-0 rounded-full transition-colors', {
                        'bg-green-500': checked,
                        'bg-white/25': !checked,
                    })}
                >
                    <span
                        className="absolute top-0.5 size-3 rounded-full bg-white transition-all"
                        style={{ left: checked ? '0.875rem' : '0.125rem' }}
                    />
                </span>
            )}
        </div>
    );
};

export const TargetCursorOverlay: FunctionComponent<TargetCursorOverlayProps> = ({ active, hover, menu, targets }) => {
    const { targetColors } = useHudColor();
    const cursorHint = useRef<HTMLDivElement>(null);
    const [path, setPath] = useState<string[]>([]);

    useNuiFocus(active, active, active);

    const close = useCallback(() => fetchNui(NuiEvent.TargetReset), []);

    // Retour à la racine à chaque fermeture du menu
    useEffect(() => {
        if (!menu) setPath([]);
    }, [menu]);

    useEffect(() => {
        if (!active) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };

        // Relâcher Alt ferme tout, menu compris
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key !== 'Alt') return;

            // Alt seul déclenche la barre de menu du navigateur au relâchement
            event.preventDefault();
            close();
        };

        // Alt-tab: le relâchement d'Alt part vers l'autre fenêtre et n'arriverait jamais ici
        const onBlur = () => close();

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
    }, [active, close]);

    const onMouseMove = (event: MouseEvent) => {
        if (!cursorHint.current) return;

        cursorHint.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    };

    const onClick = (event: MouseEvent) => {
        event.preventDefault();

        fetchNui(NuiEvent.TargetCursorClick, {
            x: event.clientX / window.innerWidth,
            y: event.clientY / window.innerHeight,
        });
    };

    if (!active) return null;

    const sortedTargets = [...targets].sort((a, b) => (a.order ?? a.label).localeCompare(b.order ?? b.label));
    const activePath = resolvePath(sortedTargets, path);
    const maxDepth = Math.max(0, ...sortedTargets.map(target => getGroupPath(target).length));

    // Le menu se replie de l'autre côté du curseur quand il n'a pas la place de s'afficher (calculé sur la profondeur
    // maximale pour que le menu principal ne bouge pas quand on ouvre un sous-menu)
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const totalWidth = (MENU_WIDTH + maxDepth * (SUB_MENU_GAP + SUB_MENU_WIDTH)) * rem;
    const flipX = menu ? menu.x * window.innerWidth + totalWidth > window.innerWidth : false;
    const flipY = menu ? menu.y > 0.55 : false;
    // Hauteur disponible du côté où le menu s'ouvre, pour que la liste défile plutôt que de sortir de l'écran
    const maxHeight = menu ? `min(60vh, calc(${(flipY ? menu.y : 1 - menu.y) * 100}vh - 1rem))` : undefined;

    const renderTarget = (target: TargetOption) => (
        <TargetCursorRow
            key={target.id}
            label={target.label}
            subLabel={target.subLabel}
            icon={target.icon}
            checked={target.checked}
            onSelect={() => fetchNui(NuiEvent.TargetSelect, target.id)}
        />
    );

    // Un panneau par niveau de sous-menu: chaque sous-menu s'ouvre à côté du précédent, qui reste affiché pour pouvoir
    // changer d'onglet rapidement
    const renderPanel = (prefix: string[]): JSX.Element => {
        const isRoot = prefix.length === 0;
        const { direct, children } = getPanelContent(sortedTargets, prefix);
        const openChild = activePath.length > prefix.length ? activePath[prefix.length] : null;
        const categories = CATEGORIES.map(category => ({
            ...category,
            targets: direct.filter(target => target.category === category.id),
        })).filter(category => category.targets.length > 0);

        const renderChild = (name: string) => (
            <TargetCursorRow
                key={name}
                label={name}
                icon={ContextMenuGroupIcons[name]?.icon}
                iconColor={ContextMenuGroupIcons[name]?.color}
                chevron="right"
                active={name === openChild}
                onSelect={() => setPath(name === openChild ? prefix : [...prefix, name])}
            />
        );

        // Dans un sous-menu, options et sous-onglets se suivent dans l'ordre défini (un sous-onglet prend la place de sa
        // première option), ce qui permet de garder une action en bas de liste
        const orderOf = (target: TargetOption) => target.order ?? target.label;
        const mixed = isRoot
            ? []
            : [
                  ...direct.map(target => ({ order: orderOf(target), node: renderTarget(target) })),
                  ...children.map(name => ({
                      order: orderOf(
                          sortedTargets.find(target =>
                              [...prefix, name].every((segment, index) => getGroupPath(target)[index] === segment)
                          )
                      ),
                      node: renderChild(name),
                  })),
              ].sort((a, b) => a.order.localeCompare(b.order));

        return (
            <div
                key={prefix.join('/')}
                className={cn({
                    absolute: !isRoot,
                    'right-full': !isRoot && flipX,
                    'left-full': !isRoot && !flipX,
                    'bottom-0': !isRoot && flipY,
                    'top-0': !isRoot && !flipY,
                })}
                style={
                    isRoot
                        ? undefined
                        : {
                              width: `${SUB_MENU_WIDTH}rem`,
                              [flipX ? 'marginRight' : 'marginLeft']: `${SUB_MENU_GAP}rem`,
                          }
                }
            >
                <GlassMorphismContainer borderClassName="rounded-xl" rounded={12} disableBorder>
                    <div
                        className="overflow-y-auto py-1 scrollbar scrollbar-w-1 scrollbar-thumb-white/80 scrollbar-thumb-rounded-full scrollbar-track-rounded-full"
                        style={{ maxHeight }}
                    >
                        {!isRoot && (
                            <h2 className="px-3 pb-0.5 pt-1.5 text-[0.65rem] uppercase tracking-wider opacity-70">
                                {prefix[prefix.length - 1]}
                            </h2>
                        )}
                        {isRoot
                            ? categories.map(({ id, title, targets: categoryTargets }) => (
                                  <div key={id}>
                                      {categories.length > 1 && (
                                          <h2
                                              className="flex items-center gap-2 px-3 pb-0.5 pt-1.5 text-[0.65rem] uppercase tracking-wider"
                                              style={{ color: targetColors[id] }}
                                          >
                                              <div
                                                  className="h-0.5 w-3 rounded-full"
                                                  style={{ background: targetColors[id] }}
                                              />
                                              <span>{title}</span>
                                          </h2>
                                      )}
                                      {categoryTargets.map(renderTarget)}
                                  </div>
                              ))
                            : mixed.map(({ node }) => node)}
                        {isRoot && children.length > 0 && direct.length > 0 && (
                            <div className="mx-3 my-1 border-t border-white/10" />
                        )}
                        {isRoot && children.map(renderChild)}
                    </div>
                </GlassMorphismContainer>

                {openChild && renderPanel([...prefix, openChild])}
            </div>
        );
    };

    // Rendu dans le body: le HUD (plein écran) est rendu après l'overlay et intercepterait sinon les clics
    return createPortal(
        <div
            className="fixed inset-0 font-prompt"
            style={{ zIndex: 2147483000 }}
            onMouseMove={onMouseMove}
            onClick={onClick}
            onContextMenu={onClick}
        >
            {hover && !menu && (
                <div ref={cursorHint} className="pointer-events-none absolute left-0 top-0 z-10">
                    <div className="-ml-[7px] -mt-[7px] size-3.5 rounded-full border-2 border-white/90 bg-white/20 shadow-lg" />
                </div>
            )}

            {menu && (
                <div
                    className="absolute z-20 text-white"
                    style={{
                        width: `${MENU_WIDTH}rem`,
                        left: `${menu.x * 100}%`,
                        top: `${menu.y * 100}%`,
                        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
                    }}
                    onClick={event => event.stopPropagation()}
                    onContextMenu={event => event.stopPropagation()}
                >
                    {renderPanel([])}
                </div>
            )}
        </div>,
        document.body
    );
};
