import { GraphicsPanel } from './GraphicsPanel';
import { KeysPanel } from './KeysPanel';
import { MinimapPanel } from './MinimapPanel';
import { registerSettingsPanel } from './registry';

registerSettingsPanel('minimap', { component: () => <MinimapPanel />, hidesDescription: true });

registerSettingsPanel('graphics', { component: () => <GraphicsPanel />, replacesList: true, hidesDescription: true });

registerSettingsPanel('voice', {
    component: ({ category }) => <GraphicsPanel category={category.nativeCategory} />,
    replacesList: true,
    hidesDescription: true,
});

registerSettingsPanel('keys', {
    component: ({ query }) => <KeysPanel query={query} />,
    replacesList: true,
    hidesDescription: true,
    searchable: true,
    searchPlaceholder: 'Rechercher une touche…',
});
