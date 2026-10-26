# Crédits

## Carte (`map/`)

Les 6 textures `minimap_sea_*` de `soz-map/stream` (carte du menu pause SoZ), décodées et converties en WebP.
Leur transparence d'origine est conservée, avec une courbe d'opacité renforcée (puissance 0,6) pour que le dégradé de l'eau reste lisible sur le jeu flouté. Chaque image couvre 4500 × 4500 unités,
à partir de l'origine (-4140, 8400) : `<ligne>_<colonne>.webp`.

`cayo.webp` : la texture `cayo` de `[lib]/ExtraMapTiles/stream/tile_cayo.ytd`, recadrée sur l'île. Elle couvre
x 3726 → 5733 et y -4139 → -6150, comme sur la carte native.

## Icônes de blips (`blips/`)

Icônes extraites des planches `blips_texturesheet_ng` / `blips_texturesheet_ng_2` de `soz-core/stream/soz_minimap.ytd`,
une par sprite. Les sprites absents de ces planches reprennent l'icône GTA V d'origine
(https://docs.fivem.net/docs/game-references/blips/).

## Codes postaux (`soz-core/src/config/postals.ts`)

Données `new-postals.json` de https://github.com/DevBlocky/nearest-postal, sous licence MIT :

    Copyright (c) 2019 BlockBa5her

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
