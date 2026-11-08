import { TemplateIcon } from '@heroicons/react/outline';

import { openPauseTab, registerPauseTab } from '../pauseTabs';
import { registerSettingItem } from '../settings/registry';
import { HudEditorTab } from './hudEditor/HudEditorTab';

registerPauseTab({
    id: 'hud',
    label: 'ATH',
    icon: <TemplateIcon />,
    component: HudEditorTab,
    fullscreen: true,
});

registerSettingItem('hud', {
    id: 'hudEditor',
    kind: 'action',
    label: 'Modifier l’ATH',
    description:
        "Ouvre l'éditeur pour placer les éléments de l'ATH (Minimap, notifications, alertes police, aide, munitions, statuts, compteur, barre de progression, icône de voix, état corporel) en voyant le résultat réel selon la situation.",
    button: "Ouvrir l'éditeur",
    onPress: () => openPauseTab('hud'),
});
