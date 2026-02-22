# Fog of War — D&D DM Tool

A desktop app for Dungeon Masters to control what players see on a map. The DM reveals areas of the map as players explore; a separate player window shows only what has been uncovered.

Built with Electron, React, TypeScript, and PixiJS v8 for WebGL rendering.

---

## Features

- **Load any map image** (PNG, JPEG, etc.) via native file dialog
- **Fog of war** painted over the map — reveal or re-hide areas with a brush
- **Brush preview cursor** — green ring for reveal, red ring for hide
- **Tokens** — place players, NPCs, and enemies on the map; toggle visibility per token
- **Pan & zoom** — scroll wheel to zoom, pan tool to navigate large maps
- **Player window** — separate read-only window showing only revealed areas; open via sidebar
- Two-window state sync via Electron IPC

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

---

## Architecture

```
src/
  main/
    index.ts        — Electron main process, two BrowserWindows (DM + Player),
                      IPC handlers, native file dialog
    gameState.ts    — Authoritative in-memory game state
  preload/
    index.ts        — contextBridge IPC API exposed to renderer
    index.d.ts      — TypeScript types for window.api
  renderer/src/
    main.tsx        — React entry point (imports pixi.js/unsafe-eval patch first)
    App.tsx         — Role-based routing (?role=dm|player)
    store/
      gameStore.ts  — Zustand store (GameState + local UI state)
    pixi/
      MapLayer.ts   — Background map sprite (async texture load via HTMLImageElement)
      FogLayer.ts   — RenderTexture fog overlay (erase/hide blend modes)
      TokenLayer.ts — Token sprites with hit testing
    components/
      MapCanvas.tsx — PixiJS Application, all pointer event handling
    views/
      DMView.tsx    — Sidebar + canvas (DM editor)
      PlayerView.tsx— Fullscreen read-only canvas
    types/index.ts  — Shared types (Token, FogOp, MapInfo, IPC constants)
```

**Fog rendering:** The fog is a PixiJS `RenderTexture` filled solid black. Reveal ops punch transparent holes using the `erase` blend mode. Hide ops paint black back with `normal` blend mode. The op list is stored and replayed identically on both windows (DM and Player).

**IPC flow:** Main process is authoritative. After every mutation it broadcasts `game:state-update` to all open windows. The renderer applies it via `window.api.onStateUpdate`.

**CSP note:** PixiJS v8's default build uses `new Function()` for shader compilation, which is blocked by Electron's CSP. The fix is `import 'pixi.js/unsafe-eval'` at the top of `main.tsx` — this patches the PixiJS renderer to use polyfills instead. Map images are loaded via `HTMLImageElement` (not `fetch`) to stay within `img-src` CSP rules.
