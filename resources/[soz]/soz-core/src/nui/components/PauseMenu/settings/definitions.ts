import { NuiEvent } from '../../../../shared/event';
import { PauseNativeConvar } from '../../../../shared/nui/pause_settings';

type SettingBase = {
    id: string;
    label: string;
    description: string;
    requiresWatch?: boolean;
};

export type ServerToggleSetting = SettingBase & {
    kind: 'toggle';
    default: boolean;
};

export type ServerSelectSetting = SettingBase & {
    kind: 'select';
    default: number | string;
    options: { value: number | string; label: string }[];
};

export type ServerActionSetting = SettingBase & {
    kind: 'action';
    button: string;
    event?: NuiEvent;
};

export type NativeSetting = SettingBase & {
    kind: 'native';
    convar: PauseNativeConvar;
    format: (raw: number) => string;
};

export type SettingItem = ServerToggleSetting | ServerSelectSetting | ServerActionSetting | NativeSetting;

export type SettingCategory = {
    id: string;
    label: string;
    native: boolean;
    staged?: boolean;
    note?: string;
    items: SettingItem[];
};

const FPS_OPTIONS = [30, 60, 90, 120, 144, 165, 240].map((value) => ({ value, label: `${value} FPS` }));

const VIDEO_VOLUME_OPTIONS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => ({
    value,
    label: `${value}%`,
}));

const MENU_SIZE_OPTIONS = [70, 80, 90, 100, 110, 120, 130].map((value) => ({ value, label: `${value}%` }));

const MENU_TEXT_OPTIONS = [
    { value: 1, label: 'Très petit' },
    { value: 2, label: 'Petit' },
    { value: 3, label: 'Normal' },
    { value: 4, label: 'Grand' },
    { value: 5, label: 'Très grand' },
];

const watch = (id: string, label: string, description: string, defaultValue: boolean): ServerToggleSetting => ({
    id,
    kind: 'toggle',
    label,
    description,
    default: defaultValue,
    requiresWatch: true,
});

const plain = (raw: number) => String(raw);

const onOff = (raw: number) => (raw > 0 ? 'Avec' : 'Sans');

const units = (raw: number) => (raw === 1 ? 'Impérial' : 'Métrique');

const native = (
    convar: PauseNativeConvar,
    label: string,
    description: string,
    format: (raw: number) => string,
): NativeSetting => ({
    id: convar,
    kind: 'native',
    convar,
    label,
    description,
    format,
});

export const SETTING_CATEGORIES: SettingCategory[] = [
    {
        id: 'map',
        label: 'Carte',
        native: false,
        items: [
            {
                id: 'potato',
                kind: 'toggle',
                label: 'Mode économe (petit PC)',
                description:
                    "Désactive le glassmorphisme et l'animation de la carte, et limite la Minimap à 30 FPS. Réduit les calculs de rendu sans changer le style de l'interface.",
                default: false,
            },
            {
                id: 'mapAnimation',
                kind: 'toggle',
                label: 'Animation de la carte',
                description:
                    "Anime l'ouverture et la fermeture du menu (la Minimap grandit jusqu'à la carte). À désactiver sur un petit PC.",
                default: true,
            },
            {
                id: 'minimapFps',
                kind: 'select',
                label: 'Limite de FPS de la Minimap',
                description:
                    'Fréquence maximale de rafraîchissement de la Minimap. Une valeur basse économise des ressources.',
                default: 60,
                options: FPS_OPTIONS,
            },
            {
                id: 'minimapOrientation',
                kind: 'select',
                label: 'Orientation de la Minimap',
                description:
                    'Suit la caméra : la carte tourne avec la caméra (par défaut). Icônes droites : la carte tourne, mais les icônes de véhicules et de joueurs ne montrent plus leur cap. Nord en haut : la carte ne tourne plus.',
                default: 'camera',
                options: [
                    { value: 'camera', label: 'Suit la caméra' },
                    { value: 'upright', label: 'Icônes droites' },
                    { value: 'north', label: 'Nord en haut' },
                ],
            },
        ],
    },
    {
        id: 'hud',
        label: 'HUD',
        native: false,
        items: [
            {
                id: 'hudEditor',
                kind: 'action',
                label: 'Modifier le HUD',
                description:
                    "Ouvre l'éditeur pour déplacer la Minimap, les éléments de la montre, l'état corporel, les notifications, les alertes police, l'aide, les munitions, les statuts du joueur, le compteur véhicule et la barre de progression. Nécessite une montre connectée.",
                button: "Ouvrir l'éditeur",
                event: NuiEvent.HudEditorOpen,
                requiresWatch: true,
            },
            watch('watchDateTime', 'Date et heure', "Affiche la date et l'heure de la montre.", true),
            watch('watchWeather', 'Météo', 'Affiche la météo de la montre.', true),
            watch('watchStreetName', 'Noms de rue', 'Affiche le nom de la rue sous la Minimap.', true),
            watch('watchCompass', 'Boussole', 'Affiche la boussole.', true),
            watch('watchStress', 'Stress', 'Affiche la jauge de stress.', true),
            watch('watchStamina', 'Endurance', "Affiche la jauge d'endurance.", true),
            watch('watchAnimalStats', "État de l'animal", "Affiche l'état de ton animal.", true),
            watch('watchInjuryTracker', 'État corporel', 'Affiche le schéma des blessures.', false),
            {
                id: 'hudVisible',
                kind: 'toggle',
                label: 'HUD : global',
                description: 'Active ou désactive le HUD.',
                default: true,
            },
            {
                id: 'hudCinematic',
                kind: 'toggle',
                label: 'HUD : cinématique',
                description: 'Active ou désactive les barres noires.',
                default: false,
            },
            {
                id: 'hudCinematicCamera',
                kind: 'toggle',
                label: 'Caméra : cinématique',
                description: 'Active ou désactive la caméra cinématique.',
                default: false,
            },
            {
                id: 'scaledNui',
                kind: 'toggle',
                label: 'Scaling NUI',
                description: 'Active ou désactive le scaling NUI.',
                default: false,
            },
            {
                id: 'glassmorphism',
                kind: 'toggle',
                label: 'Glassmorphisme',
                description: "Active ou désactive le glassmorphisme du HUD (fond d'arrière-plan flou).",
                default: true,
            },
            {
                id: 'glassmorphismFps',
                kind: 'select',
                label: 'Glassmorphisme : limite de FPS',
                description: 'Limite de FPS pour le glassmorphisme du HUD.',
                default: 30,
                options: FPS_OPTIONS,
            },
        ],
    },
    {
        id: 'menus',
        label: 'Menus',
        native: false,
        items: [
            {
                id: 'menuSize',
                kind: 'select',
                label: 'Taille du menu',
                description:
                    "Redimensionne les menus SoZ (F1, garages, boutiques…). Pris en compte à la prochaine ouverture d'un menu.",
                default: 100,
                options: MENU_SIZE_OPTIONS,
            },
            {
                id: 'menuTextSize',
                kind: 'select',
                label: 'Taille du texte',
                description: 'Agrandit ou réduit le texte des menus SoZ sans changer leur largeur.',
                default: 3,
                options: MENU_TEXT_OPTIONS,
            },
        ],
    },
    {
        id: 'crosshair',
        label: 'Viseur',
        native: false,
        items: [],
    },
    {
        id: 'voip',
        label: 'VoIP',
        native: false,
        items: [
            {
                id: 'voipReset',
                kind: 'action',
                label: 'Redémarrer la voip',
                description: 'Reconnecte le chat vocal en cas de problème.',
                button: 'Redémarrer',
            },
            {
                id: 'voipIntent',
                kind: 'select',
                label: 'Filtre voip',
                description: 'Permet de changer le filtre sur la voip.',
                default: 'speech',
                options: [
                    { value: 'speech', label: 'Voix' },
                    { value: 'music', label: 'Musique' },
                ],
            },
            {
                id: 'videoVolume',
                kind: 'select',
                label: 'Volume vidéo des écrans',
                description: 'Permet de changer le volume des vidéos sur les écrans.',
                default: 50,
                options: VIDEO_VOLUME_OPTIONS,
            },
        ],
    },
    {
        id: 'volume',
        label: 'Volume',
        native: true,
        items: [
            native('profile_sfxVolume', 'Volume effets sonores', 'Volume des effets sonores du jeu.', plain),
            native('profile_musicVolume', 'Volume musique', 'Volume de la musique du jeu.', plain),
            native(
                'profile_musicVolumeInMp',
                'Volume musique en ligne',
                'Volume de la musique en partie en ligne.',
                plain,
            ),
            native(
                'profile_audioMuteOnFocusLoss',
                'Couper le son en changeant de fenêtre',
                'Coupe le son du jeu quand la fenêtre de GTA perd le focus.',
                onOff,
            ),
        ],
    },
    {
        id: 'display',
        label: 'Affichage',
        native: true,
        items: [
            native('profile_gamma', 'Luminosité', "Luminosité générale de l'image (gamma).", plain),
            native(
                'profile_safezoneSize',
                'Zone neutre',
                "Marge de sécurité de l'affichage sur les bords de l'écran.",
                plain,
            ),
            native('profile_subtitles', 'Sous-titres', 'Affiche les sous-titres des dialogues.', onOff),
            native('profile_measurementSystem', "Système d'unités", 'Unités affichées dans le jeu.', units),
            native('profile_currentLanguage', 'Langue', 'Langue du jeu (identifiant de langue GTA).', plain),
        ],
    },
    {
        id: 'graphics',
        label: 'Graphismes',
        native: true,
        note: 'Les réglages graphiques classiques (MSAA, textures, ombres…) se règlent encore dans le menu natif de GTA.',
        items: [],
    },
    {
        id: 'graphicsAdvanced',
        label: 'Graphismes avancés',
        native: true,
        staged: true,
        items: [
            native(
                'profile_advGfxLongShadows',
                'Ombres longues',
                'Ombres plus longues au lever et au coucher du soleil.',
                onOff,
            ),
            native('profile_advGfxUltraShadows', 'Ombres haute résolution', 'Ombres en haute résolution.', onOff),
            native(
                'profile_advGfxHdFlight',
                'Streaming HD en vol',
                'Charge les textures en haute définition en vol.',
                onOff,
            ),
            native(
                'profile_advGfxMaxLod',
                'Distance de détail étendue',
                'Distance à laquelle les objets restent détaillés.',
                plain,
            ),
            native(
                'profile_advGfxShadowsDistMult',
                "Distance d'ombres étendue",
                'Distance à laquelle les ombres sont dessinées.',
                plain,
            ),
        ],
    },
    {
        id: 'controls',
        label: 'Commandes',
        native: true,
        items: [
            native('profile_targetConfig', 'Mode de visée', 'Mode de visée des armes.', plain),
            native(
                'profile_kbmToggleAim',
                'Visée : appuyer pour basculer',
                'Un appui active la visée au lieu de maintenir la touche.',
                onOff,
            ),
            native('profile_invertMouse', 'Inverser la souris', "Inverse l'axe vertical de la souris.", onOff),
            native(
                'profile_invertLook',
                'Inverser la vue (manette)',
                "Inverse l'axe vertical de la vue à la manette.",
                onOff,
            ),
            native('profile_vibration', 'Vibration', 'Vibration de la manette.', onOff),
            native(
                'profile_alternateHandbrake',
                'Frein à main alternatif',
                'Utilise la commande alternative pour le frein à main.',
                onOff,
            ),
            native(
                'profile_alternateDriveby',
                'Tir en véhicule alternatif',
                'Utilise la commande alternative pour tirer depuis un véhicule.',
                onOff,
            ),
            native(
                'profile_mouseOnFootScale',
                'Sensibilité souris à pied',
                'Sensibilité de la souris quand tu es à pied.',
                plain,
            ),
            native(
                'profile_mouseDrivingScale',
                'Sensibilité souris en conduite',
                'Sensibilité de la souris en conduite.',
                plain,
            ),
        ],
    },
    {
        id: 'camera',
        label: 'Caméra',
        native: true,
        items: [
            native(
                'profile_fpsFieldOfView',
                'Champ de vision à la première personne',
                'Angle de vision de la caméra à la première personne.',
                plain,
            ),
            native(
                'profile_cameraHeight',
                'Hauteur de la caméra véhicule',
                'Hauteur de la caméra pendant la conduite.',
                plain,
            ),
            native('profile_hoodCamera', 'Caméra capot', 'Ajoute la caméra capot aux vues du véhicule.', onOff),
            native(
                'profile_cinematicShooting',
                'Tir cinématique',
                'Active le ralenti cinématique pendant les fusillades.',
                onOff,
            ),
            native(
                'profile_fpsHeadbob',
                'Balancement de la tête',
                'Balancement de la caméra à la première personne en marchant.',
                onOff,
            ),
            native(
                'profile_fpsRagdoll',
                'Chute à la première personne',
                'Garde la vue à la première personne pendant les chutes.',
                onOff,
            ),
            native(
                'profile_fpsCombatroll',
                'Roulade à la première personne',
                'Garde la vue à la première personne pendant les roulades.',
                onOff,
            ),
            native(
                'profile_fpsAutoLevel',
                'Mise à niveau automatique',
                'Remet la caméra à niveau automatiquement.',
                onOff,
            ),
            native(
                'profile_fpsPersistantView',
                'Vue persistante',
                'Conserve la vue à la première personne entre les situations.',
                onOff,
            ),
            native(
                'profile_fpsThirdPersonCover',
                'Couverture à la troisième personne',
                'Passe à la troisième personne à couvert.',
                onOff,
            ),
            native(
                'profile_fpsVehAutoCenter',
                'Recentrage en véhicule',
                'Recentre la caméra du véhicule automatiquement.',
                onOff,
            ),
            native(
                'profile_fpsRelativeVehicleCameraDrivebyAiming',
                'Visée relative en véhicule',
                'La visée depuis un véhicule suit la caméra du véhicule.',
                onOff,
            ),
        ],
    },
    {
        id: 'voice',
        label: 'Chat vocal',
        native: true,
        note: 'Le chat vocal se règle dans le menu natif de GTA.',
        items: [],
    },
    {
        id: 'keys',
        label: 'Touches',
        native: true,
        note: 'Les touches se règlent dans le menu natif de GTA.',
        items: [],
    },
];
