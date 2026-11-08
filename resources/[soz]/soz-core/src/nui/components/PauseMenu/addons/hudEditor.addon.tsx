import { NuiEvent } from '../../../../shared/event';
import { registerSettingItem } from '../settings/registry';

registerSettingItem('hud', {
    id: 'hudEditor',
    kind: 'action',
    label: 'Modifier le HUD',
    description:
        "Ouvre l'éditeur pour déplacer la Minimap, les éléments de la montre, l'état corporel, les notifications, les alertes police, l'aide, les munitions, les statuts du joueur, le compteur véhicule et la barre de progression. Nécessite une montre connectée.",
    button: "Ouvrir l'éditeur",
    event: NuiEvent.HudEditorOpen,
    requiresWatch: true,
});
