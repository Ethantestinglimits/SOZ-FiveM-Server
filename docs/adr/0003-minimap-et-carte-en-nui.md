---
status: accepted
---

# Minimap et carte du Menu pause SoZ rendues en NUI

La Minimap native de GTA est remplacée par une Minimap NUI qui partage le moteur de rendu de la carte du Menu pause SoZ : à l'ouverture du menu, c'est le même élément qui s'agrandit jusqu'au panneau carte. On choisit la cohérence visuelle (mêmes tuiles, mêmes icônes, mêmes couches) et une transition sans couture plutôt que les avantages du radar natif. Validé en jeu par le prototype conservé sur la branche `prototype/nui-minimap` : fluidité en conduite, itinéraire GPS, blips des autres scripts, zones, transition vers le panneau, clic waypoint.

## Considered Options

- **Radar natif piloté** (`SetMinimapComponentPosition`, `SetRadarZoom`, `LockMinimapAngle`) : perf et itinéraire GPS natifs, mais rendu impossible à harmoniser avec une interface NUI, et toute surcouche (régions, codes postaux, clic waypoint) à caler à la main sur l'échelle du radar.

## Consequences

- La Minimap native reste masquée en permanence ; le canvas tourne en continu quand la Minimap est visible, d'où un budget de perf à surveiller.
- L'itinéraire GPS et les blips posés par les autres scripts doivent être relus depuis le jeu et redessinés.
