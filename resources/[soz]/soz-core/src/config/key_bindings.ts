export type KeyBindingCategoryId =
    | 'general'
    | 'menus'
    | 'inventory'
    | 'animations'
    | 'vehicle'
    | 'voice'
    | 'housing'
    | 'jobs'
    | 'events'
    | 'admin'
    | 'other';

export const KeyBindingCategories: { id: KeyBindingCategoryId; label: string; admin?: boolean }[] = [
    { id: 'general', label: 'Général' },
    { id: 'menus', label: 'Menus' },
    { id: 'inventory', label: 'Inventaire' },
    { id: 'animations', label: 'Animations' },
    { id: 'vehicle', label: 'Véhicule' },
    { id: 'voice', label: 'Voix et radio' },
    { id: 'housing', label: 'Habitation' },
    { id: 'jobs', label: 'Métiers' },
    { id: 'events', label: 'Événements' },
    { id: 'admin', label: 'Admin', admin: true },
    { id: 'other', label: 'Autres' },
];

const range = (count: number, build: (index: number) => [string, string]) =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => build(index)));

const inCategory = (category: KeyBindingCategoryId, labels: Record<string, string>) =>
    Object.fromEntries(Object.entries(labels).map(([command, label]) => [command, { category, label }]));

export const KeyBindingCommands: Record<string, { category: KeyBindingCategoryId; label: string }> = {
    ...inCategory('general', {
        phone: 'Afficher le téléphone',
        soz_core_quick_show_watch: 'Afficher la montre connectée',
        'view-mode-toggle': 'Activer ou désactiver la vue à la première personne',
        '+target': 'Activer le mode ciblage',
        'soz-quick-interaction': 'Interaction rapide',
        openanimalui: "Ouvrir le menu de l'animal",
    }),
    ...inCategory('menus', {
        soz_core_toggle_personal_menu: 'Ouvrir le menu personnel',
        'society-menu': "Ouvrir le menu d'entreprise",
        soz_menu_toggle_focus_2: 'Activer ou désactiver la souris dans un menu',
        soz_menu_up: 'Monter dans un menu',
        soz_menu_down: 'Descendre dans un menu',
        soz_menu_left: 'Aller à gauche dans un menu',
        soz_menu_right: 'Aller à droite dans un menu',
        soz_menu_enter: 'Valider dans un menu',
        soz_menu_back: 'Revenir en arrière dans un menu',
        soz_menu_close: 'Fermer un menu',
        soz_menu_reset: 'Réinitialiser une option de menu',
    }),
    ...inCategory('inventory', {
        inventory: "Ouvrir l'inventaire",
        openPlayerKeyInventory: 'Ouvrir le trousseau de clés',
        'open-wallet': 'Ouvrir le portefeuille',
        ...range(10, index => [`inventory.use.${(index + 1) % 10}`, `Utiliser le raccourci ${index + 1}`]),
    }),
    ...inCategory('animations', {
        animation_handsup: 'Lever les mains',
        animation_point: 'Pointer du doigt',
        animation_ragdoll: 'Se laisser tomber',
        animation_stop: "Arrêter l'animation",
        ...range(10, index => [
            `animation_shortcut_${String(index + 1).padStart(2, '0')}`,
            `Animation personnalisée ${index + 1}`,
        ]),
    }),
    ...inCategory('vehicle', {
        soz_vehicle_toggle_vehicle_lock: 'Verrouiller ou déverrouiller le véhicule',
        soz_vehicle_toggle_vehicle_trunk: 'Ouvrir le coffre',
        soz_vehicle_toggle_glovebox: 'Ouvrir la boîte à gants',
        soz_vehicle_toggle_menu: 'Ouvrir le menu du véhicule',
        soz_vehicle_toggle_vehicle_seatbelt: 'Mettre ou enlever la ceinture',
        vehiclelimitersetter: 'Activer ou désactiver le limiteur',
        soz_vehicle_toggle_vehicle_rappel: 'Descendre en rappel',
    }),
    ...inCategory('voice', {
        '+radio_lr_primary': 'Parler à la radio fixe (canal principal)',
        '+radio_lr_secondary': 'Parler à la radio fixe (canal secondaire)',
        '+radio_sr_primary': 'Parler à la radio portative (canal principal)',
        '+radio_sr_secondary': 'Parler à la radio portative (canal secondaire)',
        'voip-voice_up': 'Parler plus fort',
        'voip-voice_down': 'Parler moins fort',
        'voip-voice_mute': 'Couper la voix',
        radio_toggle: 'Sortir la radio',
    }),
    ...inCategory('housing', {
        'housing-menu': "Ouvrir le menu de l'habitation",
        'housing-lights': 'Allumer ou éteindre les lumières',
        gizmo_toggle_focus: 'Basculer entre la caméra et la souris',
        gizmo_place: "Confirmer et placer l'objet",
        gizmo_delete: "Supprimer l'objet",
        gizmo_toggle_snap: "Aligner l'objet",
        gizmo_toggle_space: 'Changer de référence',
        gizmo_toggle_editor: 'Basculer entre déplacement et rotation',
        soz_object_editor_validate: "Valider l'objet",
        soz_object_editor_delete: "Supprimer l'objet en cours",
        soz_object_editor_duplicate: "Dupliquer et valider l'objet",
    }),
    ...inCategory('jobs', {
        togglesirens: 'Sirène : passer du code 3 au code 2',
        'Horodateur-Taxi': "Afficher l'horodateur du taxi",
        'Horodateur-Taxi-active': "Démarrer ou arrêter l'horodateur",
    }),
    ...inCategory('events', {
        soz_halloween_vampire_game_menu: 'Ouvrir le menu du jeu Halloween Vampire',
        soz_halloween_vampire_game_objective: 'Afficher les objectifs du jeu Halloween Vampire',
    }),
    ...inCategory('admin', {
        admin: 'Ouvrir le menu admin',
        admin_mapper_menu: 'Ouvrir le menu de mapping',
        admin_swap_spectate_cam: 'Changer de caméra en spectateur',
        admin_leave_spectate: 'Quitter le mode spectateur',
        soz_admin_finish_create_zone: 'Terminer la création de zone',
        noclip: 'Activer ou désactiver le noclip',
        noclipincreasespeed: 'Accélérer le noclip',
        noclipdecreasespeed: 'Ralentir le noclip',
    }),
};
