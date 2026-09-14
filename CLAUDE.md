# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SOZ is a FiveM (GTA V multiplayer) roleplay server, built on the CitizenFX/FXServer runtime. Almost all active
development happens in `resources/[soz]/soz-core`, a single TypeScript resource that is slowly absorbing
functionality that used to live in separate Lua resources (see `INTERNAL.md`). Everything else under `resources/`
is either a third-party/base FiveM resource, a legacy `qb-core`-based resource being phased out, or static
game-content assets (clothes, vehicles, weapons, mapping, props) — only small fixes go there; new features go in
`soz-core`.

## Commands

All commands run from `resources/[soz]/soz-core`.

```
yarn install                          # install deps
yarn lint                             # tsc -p tsconfig.json --noEmit (the only standalone type/lint check)
yarn run build-module                 # webpack build of the FXServer client.js + server.js (production)
yarn run build-nui                    # webpack build of the browser NUI bundle (production)
yarn build                            # both of the above, in parallel
yarn dev                              # both of the above in watch/dev mode (webpack --watch + webpack-dev-server w/ HMR)
yarn run prisma migrate deploy        # apply DB migrations
yarn run prisma db seed               # seed base data
```

There is no test suite (no jest/mocha script, no test files) — `yarn lint` (a full `tsc --noEmit`) is the only
automated correctness check available, and always run it after changes. ESLint runs as a webpack plugin during
`build-module`/`build-nui` (`.eslintrc.json`), not as a separate script, so a build can catch lint issues that
`yarn lint` (type-check only) won't.

To actually run the server: `FXServer.exe +exec server.cfg` (see README.md for full setup: `env.cfg`, DB, seed).
`server.cfg` pulls in `modules.cfg`, which selects which resource set to boot (`modules-prod.cfg` vs
`modules-test.cfg`).

## Architecture

### Module/Provider/DI system

`soz-core` has three separate entry points/bundles, each built independently:
- `src/client.ts` → `client.js` (runs in the FiveM game client)
- `src/server.ts` → `server.js` (runs on the FXServer)
- `src/nui.tsx` → the browser-side React UI bundle (runs inside the in-game NUI browser, its own webpack config)

Features are organized as **modules** under `src/client/<feature>/<feature>.module.ts` and
`src/server/<feature>/<feature>.module.ts`, each imported once into `client.ts`/`server.ts`. A module registers
**providers** — plain classes decorated with `@Provider()` (built on an `@Injectable()`/`@Inject()` DI layer around
inversify). Providers are where nearly all logic lives; do not look for a central "router" or "event bus" file.

Custom method decorators in `src/core/decorators/` bridge FXServer natives/events into provider methods — this is
the vocabulary you need to read before making non-trivial changes:
- `@OnEvent` / `@OnGameEvent` — client/server `TriggerEvent`/game events
- `@OnNuiEvent` — messages sent from the NUI (browser) side via `fetchNui`
- `@Tick(intervalMs)` — per-frame or interval polling loops (`TickInterval.EVERY_FRAME`, `EVERY_SECOND`, etc.)
- `@Once(OnceStep)` — run once at a given lifecycle step (e.g. `OnceStep.PlayerLoaded`)
- `@PlayerUpdate()` — fires whenever the current player's `PlayerData` changes
- `@Command`, `@Cron`, `@StateSelector` (redux store selectors), `@Inject`/`@Injectable`

### Directory split

- `src/shared/` — types/constants used by both client and server (and sometimes NUI): e.g. `shared/player.ts`
  (`PlayerData`/metadata shape), `shared/event/` (the `ClientEvent`/`ServerEvent`/`NuiEvent`/`GameEvent` enums —
  every cross-boundary event name is defined here, nowhere else).
- `src/config/` — static game-content configuration data, not logic (e.g. `config/animation.ts`,
  `config/shops.ts`). Some of these files are very large; read surgically rather than in full.
- `src/client/`, `src/server/` — the FXServer-side code, one directory per feature domain.
- `src/nui/` — the React browser UI (components, hooks, store). Talks to the client bundle only through
  `NuiEvent`/`fetchNui` (NUI → client) and `nuiDispatch.dispatch(...)` (client → NUI), never directly.
- `src/core/` — the framework itself (decorators, DI, RPC helpers) — rarely needs changes.

### Path aliases (`tsconfig.json`)

`@public/*` → `src/*`, `@core/*` → `src/core/*`, `@private/*` → `private/*` (a directory of proprietary
SOZ-specific code that *is* present in this checkout and tracked in git, but is stripped from the public OSS
mirror — don't be surprised by `@private` imports resolving locally but not existing in the public repo history).

### Player data / metadata

Player state travels as `PlayerData` (`shared/player.ts`), with free-form fields under `.metadata`. Metadata is
still persisted through the legacy `qb-core` framework (`resources/[qb]/qb-core`): the generic
`QBCore:Server:SetMetaData` server event is the common way to set a new metadata field without adding a dedicated
event (see `mood`, `aimstyle` for examples), and **`Player.Functions.SetMetaData` lowercases the key on write**
(`resources/[qb]/qb-core/server/player.lua`) — metadata field names must be all-lowercase end to end, or a
client-side read of `player.metadata.someCamelCaseKey` will silently and permanently miss the stored value.

### NUI menus

In-game menus (the F1 personal menu, shop menus, etc.) are React components under `src/nui/components/Menu/`,
driven by `MenuType` + data passed from `openMenu()` on the client side, and fed static choice lists straight from
`src/config/*` (e.g. `Walks`/`Moods`/`AimStyles` in `config/animation.ts` are rendered directly into menu items).
