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

export type NativeSetting = SettingBase & {
    kind: 'native';
    convar: PauseNativeConvar;
    format: (raw: number) => string;
};

export type SettingItem = ServerToggleSetting | NativeSetting;

export type SettingCategory = {
    id: string;
    label: string;
    native: boolean;
    note?: string;
    items: SettingItem[];
};

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
                id: 'mapAnimation',
                kind: 'toggle',
                label: 'Animation de la carte',
                description:
                    "Anime l'ouverture et la fermeture du menu (la Minimap grandit jusqu'à la carte). À désactiver sur un petit PC.",
                default: true,
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
                description: 'Inverse l\'axe vertical de la souris.',
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
