# SOZ

Serveur de jeu de rôle GTA V. Ce glossaire fixe le vocabulaire du domaine : les termes propres à l'univers et aux règles du serveur, pas les concepts techniques généraux.

Les définitions sont en français ; les identifiants correspondants dans le code restent en anglais, comme le reste du repo.

## Language

### Taser

**Électrocution** :
La phase pendant laquelle un joueur touché par un taser est au sol, immobilisé en ragdoll. Comportement du jeu de base.
_Avoid_: tasé, stun, choc

**Étourdissement** :
L'état d'un joueur qui s'est relevé après une électrocution mais n'a pas encore récupéré : sa vue est troublée, sa démarche instable, et une partie de ses actions lui est refusée. Se termine de lui-même, et se cumule si le joueur est touché à nouveau pendant qu'il dure.
_Avoid_: tasé, groggy, sonné, stun

### Menu pause et carte

**Minimap**:
Petite carte SoZ affichée en bas à gauche de l'écran en jeu, même rendu que la carte du Menu pause SoZ.
_Avoid_: Radar, GPS, minimap native

**Menu pause SoZ**:
Interface plein écran ouverte par Échap, qui remplace le menu pause natif de GTA.
_Avoid_: Menu pause natif, menu ESC

**Panneau carte**:
Carte du Menu pause SoZ, à droite de la colonne, atteinte depuis la Minimap par une transition d'agrandissement.
_Avoid_: Carte plein écran, bigmap, carte native

**Point d'intérêt**:
Lieu signalé sur la carte par une icône SoZ (magasin, banque, service public…).
_Avoid_: POI, blip, location

**Couche de carte**:
Information affichable ou masquable sur la carte : Points d'intérêt, noms des régions, codes postaux.
_Avoid_: Layer, calque

**Réglage natif**:
Réglage appartenant au jeu GTA (volume, graphismes, touches, caméra…), que SoZ peut afficher mais pas toujours modifier.
_Avoid_: Paramètre GTA, option native

**Réglage serveur**:
Réglage propre à SoZ (HUD, Viseur, véhicule, menus…), propre à chaque joueur.
_Avoid_: Préférence, option SoZ
