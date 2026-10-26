import { PauseNativeConvar } from '../../../../shared/nui/pause_settings';

type SettingBase = {
    id: string;
    label: string;
    description: string;
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
    note?: string;
    items: SettingItem[];
};

const FPS_OPTIONS = [30, 60, 90, 120, 144, 165, 240].map((value) => ({ value, label: `${value} FPS` }));

const VIDEO_VOLUME_OPTIONS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => ({
    value,
    label: `${value}%`,
}));

const plain = (raw: number) => String(raw);

const onOff = (raw: number) => (raw > 0 ? 'Avec' : 'Sans');

const units = (raw: number) => (raw === 1 ? 'Impérial' : 'Métrique');

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
                    'Fond du menu noir à la place du flou, panneaux sans effet verre, sans animation, Minimap limitée à 30 FPS, glassmorphisme du HUD désactivé. Réduit fortement les calculs de rendu.',
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
        ],
    },
    {
        id: 'hud',
        label: 'HUD',
        native: false,
        items: [
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
            {
                id: 'profile_sfxVolume',
                kind: 'native',
                convar: 'profile_sfxVolume',
                label: 'Volume effets sonores',
                description: 'Volume des effets sonores du jeu.',
                format: plain,
            },
            {
                id: 'profile_musicVolume',
                kind: 'native',
                convar: 'profile_musicVolume',
                label: 'Volume musique',
                description: 'Volume de la musique du jeu.',
                format: plain,
            },
        ],
    },
    {
        id: 'display',
        label: 'Affichage',
        native: true,
        items: [
            {
                id: 'profile_gamma',
                kind: 'native',
                convar: 'profile_gamma',
                label: 'Gamma',
                description: "Luminosité générale de l'image.",
                format: plain,
            },
            {
                id: 'profile_safezoneSize',
                kind: 'native',
                convar: 'profile_safezoneSize',
                label: 'Zone neutre',
                description: "Marge de sécurité de l'affichage sur les bords de l'écran.",
                format: plain,
            },
            {
                id: 'profile_measurementSystem',
                kind: 'native',
                convar: 'profile_measurementSystem',
                label: "Système d'unités",
                description: 'Unités affichées dans le jeu (métrique ou impérial).',
                format: units,
            },
            {
                id: 'profile_currentLanguage',
                kind: 'native',
                convar: 'profile_currentLanguage',
                label: 'Langue',
                description: 'Langue du jeu (identifiant de langue GTA).',
                format: plain,
            },
        ],
    },
    {
        id: 'graphics',
        label: 'Graphismes',
        native: true,
        note: 'Les réglages graphiques sont gérés par GTA et ne peuvent pas être lus ici.',
        items: [],
    },
    {
        id: 'controls',
        label: 'Commandes',
        native: true,
        items: [
            {
                id: 'profile_vibration',
                kind: 'native',
                convar: 'profile_vibration',
                label: 'Vibration',
                description: 'Vibration de la manette.',
                format: onOff,
            },
            {
                id: 'profile_invertMouse',
                kind: 'native',
                convar: 'profile_invertMouse',
                label: 'Inverser vue souris',
                description: "Inverse l'axe vertical de la souris.",
                format: onOff,
            },
            {
                id: 'profile_mouseOnFootScale',
                kind: 'native',
                convar: 'profile_mouseOnFootScale',
                label: 'Sensibilité souris à pied',
                description: 'Sensibilité de la souris quand tu es à pied.',
                format: plain,
            },
            {
                id: 'profile_targetConfig',
                kind: 'native',
                convar: 'profile_targetConfig',
                label: 'Mode visée',
                description: 'Mode de visée (identifiant GTA).',
                format: plain,
            },
        ],
    },
    {
        id: 'camera',
        label: 'Caméra',
        native: true,
        items: [
            {
                id: 'profile_fpsFieldOfView',
                kind: 'native',
                convar: 'profile_fpsFieldOfView',
                label: 'Champ de vision à la première personne',
                description: 'Angle de vision de la caméra à la première personne.',
                format: plain,
            },
            {
                id: 'profile_cameraHeight',
                kind: 'native',
                convar: 'profile_cameraHeight',
                label: 'Hauteur de la caméra véhicule',
                description: 'Hauteur de la caméra pendant la conduite.',
                format: plain,
            },
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
