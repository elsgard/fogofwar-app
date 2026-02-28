# Fog of War — D&D DM Tool

A desktop app for Dungeon Masters to control what players see on a map. The DM reveals areas of the map as players explore; a separate player window shows only what has been uncovered.

Built with Electron, React, TypeScript, and PixiJS v8 for WebGL rendering.

---

## Features

- **Load any map image** (PNG, JPEG, etc.) via native file dialog
- **Fog of war** painted over the map — reveal or re-hide areas with a brush (feathered edges)
- **Brush preview cursor** — green ring for reveal, red ring for hide
- **Tokens** — place players, NPCs, and enemies on the map; toggle visibility and status (alive / DSA / dead) per token
- **Token settings** — global size, label size, and label visibility sliders synced to all views
- **Selected token highlight** — green outline on the active token in DM view
- **Laser pointer** — DM points to areas on the map with a glowing dot and fading trail; configurable color and size; synced to all player views in real time
- **Pan & zoom** — scroll wheel to zoom, pan tool to navigate large maps
- **Player viewport push** — DM can lock the player view to their current pan/zoom, or reset it to auto-fit
- **Player window** — separate read-only Electron window showing only revealed areas
- **Browser player** — open `localhost:7654?role=player` in any browser; updates via SSE
- **Save / Load** — scene saved to `.fowsave` (JSON + base64 image, versioned)
- **Menu bar** — Session / Map / Player drop-down menus; hover to switch, click background to close
- **Keyboard shortcuts** — `R` reveal, `H` hide, `T` move token, `P` pan, `L` laser; `Tab` cycles tools
- **Monster database** — load a local D&D 5e monster JSON file; search by name to auto-fill token stats; view full character sheet (stat block + abilities + traits/actions) from the token editor or battle tracker

---

## Dev Setup

```bash
npm install
npm run dev        # start dev server + Electron
npm run build      # typecheck + build
npm run typecheck  # type-check only
npm run lint
```

### Build for distribution

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

Press **F12** in any window to open DevTools (works in production builds too).

---

## Architecture

```
src/
  main/
    index.ts        — Electron main process, two BrowserWindows (DM + Player),
                      IPC handlers, native file dialog, SSE server (port 7654)
    gameState.ts    — Authoritative in-memory game state
  preload/
    index.ts        — contextBridge IPC API exposed to renderer
    index.d.ts      — TypeScript types for window.api
  renderer/src/
    main.tsx        — React entry point (imports pixi.js/unsafe-eval patch first)
    App.tsx         — Role-based routing (?role=dm|player); SSE client for browser player
    store/
      gameStore.ts  — Zustand store (GameState + local UI state)
    pixi/
      MapLayer.ts   — Background map sprite (async texture load via HTMLImageElement)
      FogLayer.ts   — RenderTexture fog overlay (erase/hide blend modes)
      TokenLayer.ts — Token sprites with hit testing and selection highlight
      LaserLayer.ts — Laser pointer dot + fading trail (PixiJS ticker, map space)
    components/
      MapCanvas.tsx — PixiJS Application, all pointer event handling
    views/
      DMView.tsx    — Menu bar + sidebar + canvas (DM editor)
      PlayerView.tsx— Fullscreen read-only canvas
    types/index.ts  — Shared types (Token, FogOp, MapInfo, IPC constants)
```

**Fog rendering:** The fog is a PixiJS `RenderTexture` filled solid black. Reveal ops punch transparent holes using the `erase` blend mode. Hide ops paint black back with `normal` blend mode. The op list is stored and replayed identically on both windows (DM and Player).

**IPC flow:** Main process is authoritative. After every mutation it broadcasts `game:state-update` to all open windows. The renderer applies it via `window.api.onStateUpdate`. The laser pointer uses its own `game:laser-pointer` channel and is never stored in game state.

**SSE server:** Runs on `http://127.0.0.1:7654`. Game state is pushed as default SSE `message` events; the laser pointer uses a named `laser-pointer` event so the two don't interfere. In production the server also serves the bundled renderer SPA.

**CSP note:** PixiJS v8's default build uses `new Function()` for shader compilation, which is blocked by Electron's CSP. The fix is `import 'pixi.js/unsafe-eval'` at the top of `main.tsx`. Map images are loaded via `HTMLImageElement` (not `fetch`) to stay within `img-src` CSP rules.

---

## Monster Database

The app supports an optional D&D 5e monster database loaded from a local JSON file. It is **not bundled** with the app — load your own copy via **Session → Load Monster DB…**.

A community-maintained SRD dataset is available at:
<https://gist.github.com/efortner/9b5a363df46d34d568c42b833344ba85>

> **Legal note:** The D&D 5e SRD content is published under the Creative Commons Attribution 4.0 International License (CC BY 4.0) as of 2023. However, Wizards of the Coast has historically been protective of their IP. The app does not bundle or fetch this data automatically — the DM must supply their own copy.

### JSON format

The file must be a JSON array of monster objects. Each entry has the following shape:

```json
[
  {
    "name": "Aboleth",
    "ac": 17,
    "size": "large",
    "creatureType": "aberration",
    "alignment": "lawful evil",
    "languages": ["deep speech", "telepathy 120 ft."],
    "maxHitPoints": 135,
    "hitDice": "18d10",
    "speed": { "walk": 10, "fly": 0, "swim": 40, "burrow": 0, "climb": 0, "hover": false },
    "stats":     { "str": 21, "dex": 9, "con": 15, "int": 18, "wis": 15, "cha": 18 },
    "modifiers": { "str": 5,  "dex": -1, "con": 2, "int": 4,  "wis": 2,  "cha": 4  },
    "savingThrows": { "str": 0, "dex": 0, "con": 6, "int": 8, "wis": 6, "cha": 0 },
    "skills": { "history": 12, "perception": 10, ... },
    "traits": ["Amphibious. The aboleth can breathe air and water.", "..."],
    "actions": { "list": ["Multiattack. The aboleth makes three tentacle attacks.", "..."] },
    "reactions": [],
    "legendaryActions": ["The aboleth can take 3 legendary actions...", "..."],
    "challenge": { "rating": "10", "xp": 5900 },
    "imageUrl": "https://example.com/aboleth.jpg"
  }
]
```

`traits`, `actions.list`, `reactions`, and `legendaryActions` are arrays of plain text strings rendered as paragraphs in the character sheet modal. `imageUrl` is optional.
