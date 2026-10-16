# L'effet visuel de l'étourdissement passe par le timecycle principal, complété d'un vignettage NUI

Remplace [0001](0001-overlay-nui-pour-l-etourdissement.md).

L'overlay d'arcs électriques de 0001 ne rendait pas l'état recherché : l'étourdissement doit se vivre comme une ivresse brutale, une vue floue sur les bords et légèrement teintée de jaune et de bleu. Or la NUI est une couche CEF composée au-dessus de l'image du jeu : `backdrop-filter` n'y voit pas le rendu du jeu, aucun flou n'est possible depuis la NUI. Le flou passe donc par un timecycle, dont la force suit l'intensité via `SetTimecycleModifierStrength` — le pilotage continu que 0001 refusait à `AnimpostfxPlay`. La teinte jaune/bleue reste un vignettage NUI, dont l'opacité suit la même intensité. Les dix premières secondes ajoutent le flou plein écran de la grippe, via `BlurService` et sa propre raison `taser`.

La couche additionnelle (`SetExtraTimecycleModifier`) a d'abord été retenue pour ne pas toucher au timecycle principal, mais le jeu y ignore `SetExtraTimecycleModifierStrength` : la force journalisée descendait bien jusqu'à zéro, le flou restait entier jusqu'à `ClearExtraTimecycleModifier` et se coupait net.

## Consequences

Le taser prend le timecycle principal pendant la phase. Il l'encadre de `PushTimecycleModifier` / `PopTimecycleModifier`, pour rendre à la fin le timecycle qui était actif avant le coup. Une caméra de police (`CAMERA_BW`) ouverte pendant la phase entre en collision : elle remplace l'effet, et sa fermeture l'efface. Le taser ne démarre ni n'arrête aucun `Animpostfx` `Drugs*` piloté par `PlayerEffectProvider` : la garantie de 0001 sur l'ivresse tient toujours.

Le nom du timecycle est un réglage de configuration ; la commande admin `taser_daze_timecycle <nom> [force]` permet de l'essayer en jeu sans rebuild.

Le grésillement sonore est abandonné : le son d'origine du taser au moment du coup suffit.
