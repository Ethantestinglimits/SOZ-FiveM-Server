import { ContextMenuEntry } from '@public/config/context-menu';

const warned = new Set<string>();

/**
 * Construit un menu contextuel à partir de sa mise en page (config/context-menu.ts): pour chaque entrée, dans l'ordre,
 * appelle l'action codée qui porte le même id.
 *
 * Une erreur dans une action ne fait pas disparaître le reste du menu, et les écarts entre la config et le code sont
 * signalés dans la console (une seule fois par menu).
 */
export const buildContextMenu = (
    name: string,
    menu: ContextMenuEntry[],
    builders: Record<string, (entry: ContextMenuEntry) => void>
): void => {
    const listed = new Set<string>();

    for (const entry of menu) {
        listed.add(entry.id);

        const build = builders[entry.id];

        if (!build) {
            if (!warned.has(`${name}:${entry.id}:missing`)) {
                warned.add(`${name}:${entry.id}:missing`);
                console.error(`[context-menu] ${name}: "${entry.id}" est dans la config mais aucune action n'a cet id`);
            }

            continue;
        }

        try {
            build(entry);
        } catch (error) {
            console.error(`[context-menu] ${name}, "${entry.id}":`, error);
        }
    }

    for (const id of Object.keys(builders)) {
        if (!listed.has(id) && !warned.has(`${name}:${id}:unused`)) {
            warned.add(`${name}:${id}:unused`);
            console.warn(`[context-menu] ${name}: l'action "${id}" existe dans le code mais n'est pas dans la config`);
        }
    }
};
