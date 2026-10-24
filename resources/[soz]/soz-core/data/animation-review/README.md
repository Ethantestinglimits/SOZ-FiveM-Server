# Tri des emotes rpemotes-reborn

Fichiers générés depuis `client/AnimationList.lua` de [rpemotes-reborn](https://github.com/alberttheprince/rpemotes-reborn), uniquement les animations du jeu de base.

- `index.json` : liste des packs.
- `packs/<pack>.json` : emotes candidates d'un pack, déjà converties au format de `src/config/animation.ts`.
- `<pack>.decisions.json` : choix faits en jeu (`keep` / `reject` + note éventuelle), écrits par le serveur.
- `excluded.json` : emotes écartées à la génération, avec la raison (`sexual`, `custom`, `custom-already-in-soz`, `duplicate-soz`, `ptfx`, `vehicle-only`, `section-skipped`).

## En jeu (admin / staff)

- `/epack` : liste les packs et l'avancement (détail dans la console F8).
- `/epack <pack>` : démarre le tri d'un pack sur la première emote non triée.
- `←` `→` naviguer, `↑` garder, `↓` rejeter, `Entrée` rejouer, `Retour` quitter.
- `/enote <texte>` : note sur l'emote affichée (après l'avoir gardée ou rejetée).
- `/epack stop` : arrête le tri.

Pendant le tri, `/e <nom>` joue aussi les emotes du pack chargé.

## Régénérer les packs

Depuis `resources/[soz]/soz-core`, avec `AnimationList.lua` et la liste des fichiers `stream/` de rpemotes-reborn téléchargés à côté :

```sh
npm i --no-save luaparse@0.3.1
node data/animation-review/tools/parse.js AnimationList.lua parsed.json
gh api "repos/alberttheprince/rpemotes-reborn/git/trees/master?recursive=1" --jq '.tree[] | select(.path|startswith("stream/")) | .path' > stream.txt
node data/animation-review/tools/convert.js parsed.json stream.txt src/config/animation.ts "../../[props]" data/animation-review
```

La régénération écrase `index.json`, `packs/` et `excluded.json`, mais pas les fichiers `*.decisions.json`.
