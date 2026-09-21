import { FDO, JobType } from '../shared/job';
import { ContextMenuLevel } from '../shared/target';

/**
 * Mise en page des menus contextuels (mode "Menu contextuel" du type de menu alt).
 *
 * Chaque menu est une liste, affichée dans l'ordre. Une entrée désigne une action (ou un bloc d'actions) codée dans un
 * provider par son `id`; ici on ne décide que de la place, du nom et du rôle requis:
 *
 * - `id`: identifiant de l'action. Ne pas le changer sans changer aussi le provider correspondant (indiqué en tête de
 *   chaque menu). Une entrée dont l'id n'existe pas dans le code, ou une action absente d'ici, est signalée dans la
 *   console F8 avec le préfixe [context-menu].
 * - `label`: le texte affiché. Les blocs qui génèrent plusieurs options (portes, fenêtres, maladies...) gardent le nom
 *   de chaque option dans le code, seul le sous-menu qui les contient se règle ici.
 * - `group`: le sous-menu. Vide = à la racine du menu. Un "/" ouvre un sous-menu dans un sous-menu, sans limite de
 *   profondeur: "⚙️ Admin/Santé/Effets".
 * - `level`: le rôle minimum ('any' par défaut). Voir ContextMenuLevel.
 *
 * Ordre: c'est celui de la liste. Un sous-menu prend la place de sa première entrée, donc pour mettre une action tout
 * en bas d'un sous-menu, sous ses sous-menus, il suffit de la mettre en dernier.
 *
 * Les conditions (conducteur seulement, véhicule avec radio, etc.) restent dans le code: une entrée listée ici peut ne
 * pas s'afficher si elle ne s'applique pas.
 */
export type ContextMenuEntry = {
    id: string;
    label?: string;
    group?: string;
    level?: ContextMenuLevel;
    /** Menu joueur: propose aussi l'action quand on clique sur soi-même (oui par défaut) */
    onSelf?: boolean;
};

const ADMIN = '⚙️ Admin';

/**
 * Menu du véhicule: clic sur son propre véhicule (ou dans le vide) quand on est dedans.
 * Code: client/vehicle/vehicle.target.menu.provider.ts (buildOptions)
 */
export const VehicleContextMenu: ContextMenuEntry[] = [
    { id: 'engine', label: 'Moteur' },
    { id: 'lock', label: 'Véhicule verrouillé' },
    { id: 'belt', label: 'Ceinture de sécurité' },
    { id: 'radio', label: 'Radio longue portée' },
    { id: 'anchor', label: 'Ancre baissée' },

    { id: 'doors', group: 'Portes' }, // une option par porte
    { id: 'roof', label: 'Toit ouvert', group: 'Portes' },
    { id: 'closeDoors', label: 'Tout fermer', group: 'Portes' },

    { id: 'windows', group: 'Fenêtres' }, // une option par fenêtre
    { id: 'windowsDown', label: 'Tout baisser', group: 'Fenêtres' },
    { id: 'windowsUp', label: 'Tout monter', group: 'Fenêtres' },

    { id: 'headlights', label: 'Phares', group: 'Éclairage' },
    { id: 'autoLights', label: 'Phares automatiques', group: 'Éclairage' },
    { id: 'highbeams', label: 'Feux de route', group: 'Éclairage' },
    { id: 'indicatorLeft', label: 'Clignotant gauche', group: 'Éclairage' },
    { id: 'indicatorRight', label: 'Clignotant droit', group: 'Éclairage' },
    { id: 'warnings', label: 'Warnings', group: 'Éclairage' },
    { id: 'interiorLight', label: 'Éclairage intérieur', group: 'Éclairage' },
    { id: 'neon', label: 'Néons', group: 'Éclairage' },

    { id: 'seats', group: 'Sièges' }, // une option par place libre

    { id: 'speedLimit', group: 'Limiteur de vitesse' }, // aucun, 50, 90, 110, 130
    { id: 'speedLimitCurrent', label: 'Vitesse actuelle', group: 'Limiteur de vitesse' },
    { id: 'speedLimitCustom', label: 'Personnalisé...', group: 'Limiteur de vitesse' },

    // Emplacement du menu admin (voir AdminVehicleContextMenu): il apparaît ici, entre les autres sous-menus
    { id: 'admin' },

    { id: 'more', label: "Plus d'options..." }, // le menu véhicule complet (touche HOME)
];

/**
 * Outils admin sur un véhicule: dans le menu du véhicule (sous "⚙️ Admin") et en cliquant un véhicule de l'extérieur.
 * Code: client/vehicle/vehicle.target.menu.provider.ts (getAdminOptions)
 */
export const AdminVehicleContextMenu: ContextMenuEntry[] = [
    { id: 'repair', label: 'Réparer', group: ADMIN },
    { id: 'clean', label: 'Nettoyer', group: ADMIN },
    { id: 'refuel', label: 'Ravitailler', group: ADMIN },
    { id: 'nos', label: 'NOS', group: ADMIN },

    { id: 'upgrade', label: 'Améliorer le véhicule', group: `${ADMIN}/Personnalisation` },
    { id: 'lsCustom', label: 'LS Custom', group: `${ADMIN}/Personnalisation` },
    { id: 'fbi', label: 'Configuration FBI', group: `${ADMIN}/Personnalisation`, level: 'admin' },
    { id: 'mapping', label: 'Cartographie', group: `${ADMIN}/Personnalisation` },

    { id: 'noBurstTyres', label: 'Pneus increvables', group: `${ADMIN}/Réglages`, level: 'staff' },
    { id: 'noStall', label: 'Calage désactivé', group: `${ADMIN}/Réglages`, level: 'staff' },
    { id: 'noSurface', label: 'Surface désactivée', group: `${ADMIN}/Réglages`, level: 'staff' },

    { id: 'saveCopy', label: 'Enregistrer une copie du véhicule', group: `${ADMIN}/Gestion`, level: 'admin' },
    { id: 'federalPound', label: 'Fourrière fédérale', group: `${ADMIN}/Gestion`, level: 'staff' },

    // Dernier, sous les sous-menus
    { id: 'delete', label: 'Supprimer le véhicule', group: ADMIN, level: 'staff' },
];

/**
 * Outils admin sur un joueur (clic sur un joueur, ou sur soi-même).
 * Code: client/admin/admin.player.target.provider.ts (getOptions)
 */
export const AdminPlayerContextMenu: ContextMenuEntry[] = [
    { id: 'spectate', label: 'Observer', group: ADMIN, level: 'gamemaster', onSelf: false },
    { id: 'goto', label: 'Aller vers le joueur', group: ADMIN, onSelf: false },
    { id: 'bring', label: 'Amener le joueur à moi', group: ADMIN, onSelf: false },
    { id: 'revive', label: 'Réanimer', group: ADMIN },
    { id: 'kill', label: 'Tuer', group: ADMIN },
    { id: 'freeze', label: 'Bloquer', group: ADMIN },
    { id: 'unfreeze', label: 'Débloquer', group: ADMIN },
    { id: 'mute', label: 'Muter', group: ADMIN },
    { id: 'unmute', label: 'Démuter', group: ADMIN },
    { id: 'search', label: 'Fouiller', group: ADMIN, level: 'staff', onSelf: false },

    { id: 'diseases', group: `${ADMIN}/Santé/Rendre malade`, level: 'staff' }, // rhume, grippe... soigner
    { id: 'effects', group: `${ADMIN}/Santé/Effets` }, // alcoolique, drogué, normal
    { id: 'injuries', group: `${ADMIN}/Santé/Blessures` }, // 0 à 12
    { id: 'attributes', group: `${ADMIN}/Santé/Attributs` }, // force, endurance... en min et max

    { id: 'voiceStatus', label: 'Statut', group: `${ADMIN}/Voix` },
    { id: 'voiceDebugOn', label: 'Debug vocal activé', group: `${ADMIN}/Voix` },
    { id: 'voiceDebugOff', label: 'Debug vocal désactivé', group: `${ADMIN}/Voix` },

    { id: 'resetSkin', label: 'Réinitialiser le skin', group: `${ADMIN}/Personnage`, level: 'staff' },
    { id: 'reputation', label: 'Changer la réputation', group: `${ADMIN}/Personnage`, level: 'staff' },
    { id: 'resetCrimi', label: 'Reset criminalité', group: `${ADMIN}/Personnage`, level: 'staff' },
    { id: 'resetClientState', label: 'Reset client state', group: `${ADMIN}/Personnage` },
    { id: 'missiveOn', label: 'Représentant de Corbin: activer', group: `${ADMIN}/Personnage`, level: 'staff' },
    { id: 'missiveOff', label: 'Représentant de Corbin: désactiver', group: `${ADMIN}/Personnage`, level: 'staff' },
    { id: 'parties', group: `${ADMIN}/Personnage/Parti politique` }, // aucun + les partis du Sénat
];

/**
 * Menu du sol (clic sur le sol ou sur un élément sans option), pour les admins.
 * Code: client/admin/admin.target.provider.ts
 */
export const WorldContextMenu: ContextMenuEntry[] = [
    { id: 'placeVehicle', label: 'Voiture', group: 'Placer' },
    { id: 'placeProps', label: 'Props', group: 'Placer' },
];

/**
 * Regroupement automatique des cibles existantes (police, LSMC, entreprises...) en sous-menus, en cliquant un joueur,
 * un PNJ ou un véhicule. Ces cibles sont déclarées un peu partout dans le code (B-Target); on ne les réécrit pas, on
 * les range ici d'après leur `job`.
 *
 * Un job n'a son propre sous-menu que si la cible affiche PLUS de `minOptions` options de ce job; en dessous, elles
 * restent à plat comme en B-Target.
 */
export const ContextMenuGrouping: {
    minOptions: number;
    jobs: { label: string; jobs: JobType[] }[];
    subGroups: { group: string; labels: string[] }[];
} = {
    minOptions: 6,

    // Nom du sous-menu d'un job, ou d'un ensemble de jobs. Sans entrée ici, un job seul prend son nom complet (JobLabel).
    jobs: [
        { label: 'Police', jobs: FDO },
        { label: 'LSMC', jobs: [JobType.LSMC] },
        { label: 'Bennys', jobs: [JobType.Bennys] },
        { label: 'UPW', jobs: [JobType.Upw] },
        { label: 'Gouvernement', jobs: [JobType.Gouv] },
    ],

    // Sous-menus dans le sous-menu du job, d'après le libellé exact de l'option. Une option absente d'ici reste
    // directement dans le sous-menu du job.
    subGroups: [
        { group: 'Arrestation', labels: ['Menotter', 'Démenotter', 'Escorter', 'Amender'] },
        {
            group: 'Contrôle',
            labels: ['Permis', 'Alcootest', 'Dépistage de drogue', 'Fouiller', 'Immatriculation', 'Ouvrir'],
        },
        {
            group: 'Recherche',
            labels: [
                "Récolte d'empreinte",
                'Rechercher des traces de poudre',
                'Rechercher des empreintes',
                'Rechercher des traces de drogue',
            ],
        },

        { group: 'Soins', labels: ['Soigner', 'Réanimer', 'Utiliser Défibrilateur', 'Naloxone', 'Morphine', 'Plâtre'] },
        {
            group: 'Examens',
            labels: [
                'Prise de sang',
                'Prise de sang pour test',
                'Etat de santé',
                'Analyse urinaire',
                'Analyse de sang',
                'Modifier la carte de santé',
            ],
        },
        { group: 'Chirurgie', labels: ['Enlever un Poumon', 'Enlever un Rein', 'Enlever le Foie', 'greffer'] },
        {
            group: 'Formation',
            labels: ['Donner le diplôme de secourisme', 'Retirer le diplôme de secourisme', "S'entrainer aux soins"],
        },

        { group: 'Remorquage', labels: ['Remorquer', 'Prendre le crochet', 'Déposer le crochet', 'Démorquer'] },
    ],
};
