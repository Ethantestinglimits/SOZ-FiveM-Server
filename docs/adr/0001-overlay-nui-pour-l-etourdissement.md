# L'effet visuel de l'étourdissement passe par un overlay NUI, pas par un postfx natif

> Remplacé par [0002](0002-timecycle-pour-l-etourdissement.md).

Pour rendre l'étourdissement visible à l'écran, l'approche évidente est `AnimpostfxPlay`, déjà utilisé dans `client/player/player.effect.provider.ts` pour la drogue et l'alcool. Nous avons choisi à la place un overlay React plein écran, sur le modèle de `nui/components/Flash/FlashApp.tsx`, parce qu'aucun postfx du jeu ne ressemble à de l'électricité — les effets disponibles sont des effets de drogue, de mort ou de course — et parce que l'overlay permet de piloter l'intensité en continu depuis l'état qui gouverne déjà le reste de la phase, ce que `AnimpostfxPlay` ne sait pas faire.

## Consequences

Le choix règle au passage un problème de collision : les postfx `Drugs*` sont pilotés par `PlayerEffectProvider` en fonction de `player.metadata.drug` et `alcohol`, et un effet de taser qui les démarrait ou les arrêtait aurait coupé l'effet d'alcool d'un joueur tazé pendant qu'il est ivre. L'overlay étant indépendant, le code du taser ne touche jamais aux postfx.

En contrepartie, l'effet n'existe que tant que la NUI est chargée et réactive : un freeze de la NUI fait disparaître l'effet visuel alors que la phase, dont le serveur fait autorité, continue de s'appliquer.
