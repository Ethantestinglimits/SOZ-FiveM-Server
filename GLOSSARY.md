# SOZ

Serveur de jeu de rôle GTA V. Ce glossaire fixe le vocabulaire du domaine : les termes propres à l'univers et aux règles du serveur, pas les concepts techniques généraux.

Les définitions sont en français ; les identifiants correspondants dans le code restent en anglais, comme le reste du repo.

## Language

### Carte

**Point personnel** :
Le point qu'un joueur pose lui-même sur sa carte, directement ou depuis une position reçue sur son téléphone. Il n'en a qu'un ; seul le joueur le pose ou le retire. Il s'affiche dans la couleur GPS du joueur.
_Avoid_: waypoint, GPS, marqueur

**Point de véhicule** :
La copie du point personnel d'un occupant, partagée à tous ceux qui sont à bord du même véhicule. Elle appartient au véhicule, pas à son auteur : elle reste après la descente de celui-ci, et disparaît quand le véhicule arrive dessus, quand son auteur, encore à bord, la retire, ou quand le véhicule se vide. Un véhicule porte au plus un point de véhicule par auteur.
_Avoid_: point partagé, point de groupe

**Couleur GPS** :
La couleur choisie par un joueur pour son point personnel et ses points de véhicule. Dans un véhicule, deux points de véhicule ne partagent jamais la même couleur.

### Taser

**Électrocution** :
La phase pendant laquelle un joueur touché par un taser est au sol, immobilisé en ragdoll. Comportement du jeu de base.
_Avoid_: tasé, stun, choc

**Étourdissement** :
L'état d'un joueur qui s'est relevé après une électrocution mais n'a pas encore récupéré : sa vue est troublée, sa démarche instable, et une partie de ses actions lui est refusée. Se termine de lui-même, et se cumule si le joueur est touché à nouveau pendant qu'il dure.
_Avoid_: tasé, groggy, sonné, stun
