# Fog of War — Technical Architecture

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Process Model](#3-process-model)
4. [Directory Structure](#4-directory-structure)
5. [Main Process](#5-main-process)
6. [Renderer Process](#6-renderer-process)
7. [State Management](#7-state-management)
8. [IPC Communication](#8-ipc-communication)
9. [PixiJS Rendering](#9-pixijs-rendering)
10. [Browser Player (SSE)](#10-browser-player-sse)
11. [Battle Tracker](#11-battle-tracker)
12. [Monster Database](#12-monster-database)
13. [File Formats](#13-file-formats)
14. [Tool System](#14-tool-system)
15. [Debug Mode](#15-debug-mode)

---

## 1. Overview

Fog of War is a desktop application for Dungeon Masters running tabletop RPG sessions. The DM loads a map image and paints fog-of-war on top of it. Players see a separate read-only window that shows only the areas the DM has revealed.

The application runs two independent windows from the same Electron process:

- **DM window** — editor with drawing tools, token management, battle tracker, and fog controls
- **Player window** — fullscreen read-only view of the map as revealed by the DM

A third delivery mode serves the player view to a web browser over a local HTTP/SSE server, useful for projecting to a TV or second screen.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Shell | [Electron](https://www.electronjs.org/) v33 |
| UI framework | [React](https://react.dev/) 18 with TypeScript |
| Build tool | [Vite](https://vitejs.dev/) via `electron-vite` |
| 2D rendering | [PixiJS](https://pixijs.com/) v8 (WebGL) |
| State management | [Zustand](https://zustand-demo.pmnd.rs/) |
| Packaging | `electron-builder` |

PixiJS runs inside the Electron renderer process, sharing the same V8 context as React. The WebGL canvas is mounted into a React-managed `<div>` and sized to fill the window.

---

## 3. Process Model

Electron separates code into two process types with a strict security boundary between them.

```
┌─────────────────────────────────────────────────────┐
│ Main Process (Node.js)                              │
│                                                     │
│  index.ts        — window management, IPC, SSE      │
│  gameState.ts    — authoritative in-memory state    │
│                                                     │
│  ┌──────────────┐      ┌──────────────────────────┐ │
│  │ DM Window    │ IPC  │ Player Window            │ │
│  │ (Renderer)   │◄────►│ (Renderer)               │ │
│  │              │      │                          │ │
│  │ React + Pixi │      │ React + Pixi             │ │
│  └──────────────┘      └──────────────────────────┘ │
│          │                                          │
│          │ IPC (one-way)                            │
│          ▼                                          │
│  ┌──────────────────────┐                          │
│  │ SSE Server :7654     │ HTTP/SSE                 │
│  │                      │◄─────── Browser Player   │
│  └──────────────────────┘                          │
└─────────────────────────────────────────────────────┘
```

The **main process** owns the authoritative game state. Renderer processes cannot talk to each other directly — all communication goes through the main process via IPC.

The **preload script** (`src/preload/index.ts`) bridges the two contexts: it uses Electron's `contextBridge` to expose a safe `window.api` object to the renderer, so the renderer can call IPC methods without having access to full Node.js APIs.

---

## 4. Directory Structure

```
src/
├── main/
│   ├── index.ts          Entry point — Electron app, windows, IPC handlers, SSE server
│   ├── gameState.ts      In-memory game state with mutation functions
│   └── debugState.ts     Debug state generator (FOG_DEBUG_STATE=1)
│
├── preload/
│   ├── index.ts          contextBridge — exposes window.api to renderers
│   └── index.d.ts        TypeScript types for window.api
│
└── renderer/src/
    ├── main.tsx          React entry — imports pixi.js/unsafe-eval first (CSP fix)
    ├── App.tsx           Role-based routing (dm / player), IPC or SSE subscription
    ├── store/
    │   └── gameStore.ts  Zustand store — GameState + local UI state
    ├── views/
    │   ├── DMView.tsx    DM editor — menu bar, sidebar, canvas
    │   ├── PlayerView.tsx  Fullscreen read-only canvas + overlays
    │   └── BattlePanel.tsx  Slide-out battle tracker panel
    ├── components/
    │   ├── MapCanvas.tsx            PixiJS host — all pointer/wheel events
    │   ├── SmokeCanvas.tsx          Standalone PixiJS particle system (idle screen)
    │   ├── MonsterRevealOverlay.tsx Sliding portrait panel (player view)
    │   ├── InitiativeStrip.tsx      Initiative order strip (player view)
    │   ├── CharacterSheetModal.tsx  Full monster stat block viewer
    │   ├── MonsterSearchModal.tsx   Monster DB search + token prefill
    │   └── ExportPartyDialog.tsx    Party export dialog
    ├── pixi/
    │   ├── MapLayer.ts    Background map sprite
    │   ├── FogLayer.ts    Fog-of-war RenderTexture
    │   ├── TokenLayer.ts  Token sprites, labels, hit testing
    │   └── LaserLayer.ts  DM laser pointer trail
    └── types/
        ├── index.ts       Shared types and IPC channel constants
        └── monster.ts     Monster DB types and helpers
```

---

## 5. Main Process

### `gameState.ts` — Authoritative State

The main process holds the single source of truth for the game state. This is intentional: the main process is the only place that mutates state, ensuring the DM and Player windows are always in sync.

```typescript
interface GameState {
  map: MapInfo | null                        // loaded map image + dimensions
  fogOps: FogOp[]                            // ordered list of fog painting operations
  fogSnapshot: string | null                 // baked fog PNG (base64) after compaction
  tokens: Token[]                            // all tokens on the map
  tokenRadius: number                        // global token display size
  tokenLabelSize: number                     // global label font size
  tokenLabelVisible: boolean                 // global label visibility toggle
  tokenLabelHiddenTypes: Record<TokenType, boolean>  // per-type label hide flags
  playerViewport: PlayerViewport | null      // pushed camera position
  battle: Battle | null                      // active battle tracker state
  monsterReveal: MonsterReveal | null        // portrait shown on player view
  idleMode: boolean                          // show idle screen on player view
  idleEffects: IdleEffects                   // per-effect toggles for the idle screen
}

interface IdleEffects {
  smoke: boolean      // rising smoke particles
  glow: boolean       // flickering dying-fire glow blobs at the bottom
  embers: boolean     // small orange-yellow spark particles
  lightning: boolean  // rare full-screen white flash
  pulse: boolean      // pulsating red radial glow overlay
}
```

All mutations go through named functions (`setMap`, `addFogOp`, `addToken`, etc.). After every mutation, `broadcastState()` is called, which sends the new state to all renderers via IPC and to any SSE clients.

`getState()` returns a `structuredClone` of the state to prevent mutation by callers.

### `index.ts` — IPC Handlers

Every action that changes game state is handled here as an IPC listener. The pattern is always:

```
Renderer → IPC → main mutates state → broadcastState() → all renderers update
```

The DM window optimistically updates its own Zustand store immediately for responsiveness, then the state broadcast from main brings everything into sync.

---

## 6. Renderer Process

### Entry: `main.tsx` and `App.tsx`

`main.tsx` is the Vite/React entry point. The first import is `pixi.js/unsafe-eval`, which is required to let PixiJS compile WebGL shaders under Electron's Content Security Policy.

`App.tsx` reads the `?role=` URL parameter to decide which view to render:

- `?role=dm` → `<DMView />`
- `?role=player` → `<PlayerView />`

On mount, it subscribes to game state updates. In Electron, this uses `window.api.onStateUpdate` (IPC). In a browser, it falls back to an `EventSource` connected to the SSE server at `http://localhost:7654/events`.

### `DMView.tsx`

The DM editor. Layout:

```
┌──────────────────────────────────────────────────────┐
│ Menu bar (36px)                                       │
│  Session ▾  Map ▾  Player ▾  [Battle]  [Push View →] │
├──────────────────────────────────────────────────────┤
│ Sidebar (300px)  │  Canvas (fills remaining width)   │
│                  │                                   │
│  Tools           │  PixiJS WebGL                     │
│  Tokens ▾        │                                   │
│    Size & Labels │                                   │
│    Add Token     │                                   │
│  Token list      │                                   │
│  Selected token  │                                   │
└──────────────────┴───────────────────────────────────┘
```

The menu bar has three dropdown menus (Session, Map, Player) and several plain buttons. Dropdowns are managed with a single `openMenu` state and close on click-outside via a `mousedown` listener.

The right side of the menu bar always shows a **🌑 Idle** button. Clicking it opens a popover with an ON/OFF toggle and five checkboxes (Smoke, Glow, Embers, Lightning, Pulse) for individual idle screen effects. When a map is loaded, **Push View →** and **Reset View** buttons also appear.

The sidebar is a flex column with `overflow: hidden`. The token list section uses `flex: 1; min-height: 0` to fill all remaining space and scrolls internally. This is important: the sidebar itself must not scroll.

### `PlayerView.tsx`

A full-window `MapCanvas` with optional overlays:

- `InitiativeStrip` — shown when a battle is active
- `MonsterRevealOverlay` — slides in from the right when the DM reveals a monster portrait
- **Idle screen** — shown when `idleMode` is true **or** no map is loaded; covers the canvas with an atmospheric waiting screen

`MapCanvas` is always mounted (even before a map is loaded) so that PixiJS and the WebGL context are fully initialized by the time the first state update arrives. Mounting it lazily would cause an initialization race where early fog ops are dropped.

#### Idle Screen

The idle screen layers several effects over a rock texture background:

| Layer | Implementation |
|---|---|
| Rock texture | CSS `background-image` on the waiting div |
| Dark overlay | `rgba(0,0,0,0.85)` div |
| Vignette | Radial gradient div (transparent center → solid black at 80% radius) |
| Red pulse | `rgba` radial gradient div; opacity driven by a `requestAnimationFrame` loop summing four sines at irrational frequencies plus random flares — never periodic |
| Smoke / fire / lightning | `SmokeCanvas` — a separate PixiJS `Application` with transparent background mounted over the overlays |

`SmokeCanvas` runs its own PixiJS ticker with three particle systems (smoke puffs, ember sparks, full-screen lightning flashes) and five flickering glow blobs at the bottom edge. Each system is gated by its corresponding flag in `idleEffects` via a ref, so toggling an effect takes place on the next frame without remounting.

After 60 seconds the bottom text transitions from "The Dungeon Master is preparing…" to a randomly shuffled queue of D&D jokes, cycling every minute.

---

## 7. State Management

### Zustand Store (`gameStore.ts`)

The renderer uses Zustand for all state. The store has two categories:

**Synchronized state** — a mirror of the main process `GameState`. Updated only through `applyState()`, which is called whenever a state broadcast arrives via IPC or SSE.

**Local UI state** — never broadcast, DM window only:
- `activeTool` — current drawing tool (`'select' | 'fog-reveal' | 'fog-hide' | 'token-move' | 'pan' | 'laser'`)
- `brushRadius` — fog brush size
- `selectedTokenId` — which token is selected in the editor
- `laserRadius`, `laserColor` — laser pointer appearance
- `monsters` — loaded monster DB entries
- `isDirty` — unsaved changes indicator

### `applyState()` — Lite Update Handling

SSE fog-op broadcasts strip the map `dataUrl` (to keep payloads small) and strip the battle log (on high-frequency events). `applyState` handles these cases:

```
incoming map.dataUrl == ""      → keep existing map object (dataUrl unchanged)
incoming fogSnapshot == ""      → keep cached snapshot (unchanged)
incoming battle.log == []       → keep existing log if same battle ID
```

This prevents the map image and fog snapshot from being re-decoded on every fog stroke.

### Fog Op Incremental Apply

`MapCanvas` tracks the previous length of the `fogOps` array. When the array grows (new ops appended), only the new ops are applied to the PixiJS fog texture — avoiding a full repaint. When the array shrinks or resets, a full replay is performed.

```
newLen > prevLen  →  apply only ops [prevLen..newLen]
newLen < prevLen  →  full replay from scratch (uses snapshot as base if present)
newLen == prevLen →  no-op (IPC echo)
```

### Fog Op Compaction

After every completed stroke, `MapCanvas` checks if `fogOps.length > 500`. When the threshold is exceeded, it calls `fogLayer.extractSnapshot()` which uses the PixiJS renderer to bake the current fog `RenderTexture` into a PNG canvas. The PNG's data URL is stored as `fogSnapshot` in `GameState` and the `fogOps` list is discarded. Future replays use the snapshot as the base layer instead of starting from solid black.

The SSE server tracks the last-sent snapshot to avoid re-transmitting the multi-MB PNG on every subsequent fog-op event. It sends `fogSnapshot: ""` in lite updates to signal "use your cached copy".

---

## 8. IPC Communication

IPC channel names are defined as constants in `src/renderer/src/types/index.ts` and shared between main and preload so there is a single source of truth.

### Channels

| Channel | Direction | Purpose |
|---|---|---|
| `game:get-state` | invoke (renderer→main) | Initial state fetch on mount |
| `game:state-update` | push (main→renderer) | Broadcast after every mutation |
| `game:load-map` | invoke | Open file dialog, return dataUrl |
| `game:load-map:commit` | send | Commit map info (with dimensions) |
| `game:add-fog-op` | send | Single fog op (unused — superseded by batch) |
| `game:batch-fog-ops` | send | Flush a full stroke as one call |
| `game:reset-fog` | send | Clear all fog |
| `game:add-token` | send | Create a token |
| `game:update-token` | send | Move or edit a token |
| `game:remove-token` | send | Delete a token |
| `game:set-token-radius` | send | Change global token size |
| `game:set-token-label-size` | send | Change label font size |
| `game:set-token-label-visible` | send | Show/hide all labels globally |
| `game:set-token-label-hidden-types` | send | Per-type label visibility (player/npc/enemy) |
| `game:reveal-all-fog` | send | Make entire map visible |
| `game:compact-fog` | send | Replace fog ops with baked snapshot |
| `game:set-player-viewport` | send | Push DM's camera to player |
| `game:save-scene` | invoke | Save dialog + write `.fowsave` |
| `game:load-scene` | invoke | Open dialog + load `.fowsave` |
| `game:save-party` | invoke | Export party to `.fowparty` |
| `game:load-party` | invoke | Import party from `.fowparty` |
| `game:open-player-window` | send | Create the Player BrowserWindow |
| `game:open-in-browser` | send | Open player URL in default browser |
| `game:laser-pointer` | send | Broadcast laser position (throttled ~60fps) |
| `game:set-battle` | send | Update full battle state |
| `game:set-monster-reveal` | send | Set/clear monster portrait on player view |
| `game:set-idle-mode` | send | Set `idleMode` + `idleEffects`; shows/hides idle screen |

### Stroke Batching

Fog painting sends **no IPC during a drag**. Ops are accumulated locally in `strokeBufferRef` and applied directly to the DM's fog texture (`fogLayer.applyOneOp`). On `pointerup`, the entire stroke is flushed as a single `game:batch-fog-ops` call. This is what keeps fog painting responsive regardless of IPC overhead.

---

## 9. PixiJS Rendering

### Scene Graph

Both views share the same scene structure, mounted on a `world` Container that handles pan/zoom:

```
app.stage
├── world  (Container — pan/zoom transform applied here)
│   ├── MapLayer    (background map sprite)
│   ├── FogLayer    (RenderTexture fog overlay)  ← order differs by view (see below)
│   ├── TokenLayer  (token circles + labels)
│   └── LaserLayer  (laser pointer trail)
└── brushCursor  (Graphics — screen space, not in world)
```

**Layer order differs by view:**

| View | Order | Effect |
|---|---|---|
| DM | map → fog → tokens → laser | Tokens always visible above fog |
| Player | map → tokens → fog → laser | Fog covers tokens in unrevealed areas |

### `MapLayer`

Loads the map as an `HTMLImageElement` (not `fetch`) for CSP compatibility, then creates a PixiJS `Texture.from(img)`. The old sprite is only swapped out after the new texture is ready, preventing a blank frame.

### `FogLayer`

The fog is a single `RenderTexture` at the map's native resolution, initially filled solid black. Operations are painted onto this texture using the PixiJS renderer directly.

**Reveal:** A feathered radial gradient sprite is drawn onto the fog texture using the `erase` blend mode, punching a transparent hole. The erase blend mode in PixiJS v8 only works correctly when the erasing container is a *non-root* child in the render call, so reveal ops are wrapped in an intermediate `Container`:

```
root Container
  └── eraseGroup Container (blendMode: 'erase')
        └── feather Sprite
```

**Hide:** The same feathered sprite, tinted black, drawn with normal blend mode — painting fog back.

**Feather cache:** Gradient textures are created once per radius value and cached. The inner 65% of the gradient is fully opaque; the outer 35% fades to transparent, giving fog edges a soft falloff.

**Alpha:** The DM fog sprite is at 50% alpha (semi-transparent overlay). The player fog is at 100% (fully opaque, hiding unrevealed areas).

### `TokenLayer`

Manages a `Map<tokenId, TokenSprite>` of PixiJS objects. Each token is a `Container` holding:

- `turnOutline` — amber ring when this is the active battle turn
- `outline` — green ring when selected in DM view
- `circle` — filled circle in the token's colour
- `statusGraphic` — X marks for dead tokens
- `statusLabel` — warning symbol for "down/stabilized/alive" (DSA) status
- `label` — text label above the token

`syncTokens` diffs the incoming token array against existing sprites, creating/destroying/updating as needed.

Hit testing is done manually (not via PixiJS events) by iterating sprites and checking distance from the pointer to each token center.

### `LaserLayer`

Stores a trail of timestamped points. Each frame (`ticker.add`), points older than 1200 ms are dropped. The trail is drawn as a series of circles fading from full opacity at the current position to transparent at the tail. The DM's pointer position is throttled to ~60 fps before being sent via IPC to avoid flooding the channel.

### Pan, Zoom, Viewport

The `world` Container's `x`, `y`, and `scale` properties control the view. Pan is handled by direct delta updates on `pointermove`. Zoom is mouse-wheel driven, scaling around the cursor position.

The `fitWorld` function calculates an initial scale to fit the full map in the available canvas area (excluding the 300px DM sidebar) and centers it.

The **Push View** feature captures the DM's current viewport as map-space center coordinates plus a scale value. This is sent as `PlayerViewport` through the state broadcast and applied in the player's `MapCanvas` via a `useEffect` on `playerViewport`.

---

## 10. Browser Player (SSE)

When the DM clicks "Open in Browser", the app opens `http://127.0.0.1:7654?role=player` in the system browser. The SSE server started at app launch serves two endpoints:

- `GET /state` — full current `GameState` as JSON (used for initial load)
- `GET /events` — SSE stream; each event is the serialized `GameState`

Because the map `dataUrl` is large (base64-encoded image), it is omitted from SSE events where the map has not changed. The browser player detects this (`dataUrl == ""`) and retains the map it already loaded. This prevents re-decoding a multi-megabyte image on every fog stroke.

Similarly, the battle log is stripped from high-frequency broadcasts (only sent when the log actually changes) to keep event payloads small.

The browser player is the same React app as the Electron player (`?role=player`). The difference is detected in `App.tsx`: if `window.api` is absent (no contextBridge = not Electron), it falls back to `fetch`/`EventSource` against the SSE server instead of IPC.

Nagle's algorithm is disabled on SSE client sockets (`socket.setNoDelay(true)`) so each `write()` is transmitted immediately without buffering.

Laser pointer updates are sent as a separate named SSE event (`event: laser-pointer`) so they don't interfere with the `message` event used for state updates.

---

## 11. Battle Tracker

The battle tracker is a slide-out panel in the DM view, toggled by the **Battle** button in the menu bar. Its state is part of `GameState` and is broadcast to the player view.

### Data Model

```typescript
interface Battle {
  id: string
  name: string
  round: number
  turnDuration: number        // seconds per turn (default 6)
  isActive: boolean
  combatants: Combatant[]
  log: BattleLogEntry[]
  createdAt: string
}

interface Combatant {
  id: string
  name: string
  initiative: number
  initiativeTieBreak: number  // secondary sort
  sortOrder: number           // tertiary sort for manual reorder
  tokenId: string | null      // linked map token
  hp: number | null
  hpMax: number | null
  ac: number | null
  isPlayerCharacter: boolean
  isVisible: boolean          // false = hidden from player initiative strip
  isActive: boolean           // true = this combatant's turn
  effects: Effect[]
}
```

Combatants are sorted by `initiative DESC`, then `initiativeTieBreak DESC`, then `sortOrder ASC`.

### Turn Cycling

Clicking **Next Turn** in the DM panel:
1. Decrements `duration` on all effects for the current active combatant; removes expired effects and logs them
2. Advances `isActive` to the next combatant (wraps around, increments `round` on wrap)
3. Logs a turn-start entry
4. Sends the updated `Battle` via `game:set-battle` IPC

### Active Turn Highlight

The active combatant's `tokenId` is resolved in `MapCanvas` and passed to `TokenLayer.setActiveTurnToken()`, which draws an amber ring around that token. This is visible in both DM and player views.

### Player Initiative Strip

`InitiativeStrip` renders a compact horizontal list of combatants in the player view when a battle is active. Combatants with `isVisible: false` are hidden.

### Battle Log

A chronological log of significant events (round starts, damage, healing, misses, effect additions/expirations, deaths). Log entries have a `kind` discriminator and a pre-formatted `text` string for display. The log is stripped from SSE broadcasts when unchanged to keep payload sizes down.

---

## 12. Monster Database

The monster database is an optional feature. The DM loads a local JSON file via **Session → Load Monster DB…**. The data is stored only in the DM's Zustand store (`monsters: MonsterEntry[] | null`) and is never broadcast.

### Expected Format

The app expects a JSON array of `MonsterEntry` objects with this structure:

```typescript
interface MonsterEntry {
  name: string
  type: string
  size: string
  alignment: string
  ac: number
  maxHitPoints: number
  speed: string
  stats: { str; dex; con; int; wis; cha }
  modifiers: { str; dex; con; int; wis; cha }
  savingThrows: Record<string, number>
  skills: Record<string, number>
  damageImmunities: string[]
  conditionImmunities: string[]
  senses: string
  languages: string
  challengeRating: string
  traits: string[]
  actions: { list: string[] }
  reactions: string[]
  legendaryActions: string[]
  imageUrl?: string
}
```

### Token Integration

The **Monster Search** modal lets the DM search by name. Selecting a monster prefills the token creation form (label, HP, AC, type) and attaches the `MonsterSheet` to the token. The sheet contains the full stat block and is serialized into save files.

### Monster Reveal

When a `Token` has a `monsterSheet.imgUrl`, the DM can click **👁 Show to Players** in the character sheet modal. This sends `{ imgUrl, name }` as a `MonsterReveal` through `game:set-monster-reveal` IPC. The player view renders a `MonsterRevealOverlay` that slides in from the right. The overlay auto-clears when the DM closes the character sheet modal.

---

## 13. File Formats

### `.fowsave` — Scene Save

A JSON file embedding the full game state, including the map image as a base64 data URL. This makes save files self-contained and portable.

```typescript
interface SaveFile {
  version: string         // app version (e.g. "0.1.0")
  savedAt: string         // ISO timestamp
  map: MapInfo | null
  fogOps: FogOp[]
  tokens: Token[]
  tokenRadius: number
  tokenLabelSize: number
  tokenLabelVisible: boolean
  playerViewport: PlayerViewport | null
  battle: Battle | null
}
```

Version compatibility is checked on load: if `major.minor` mismatches, a warning dialog is shown.

### `.fowparty` — Party Export

A JSON file containing a subset of tokens (player characters). On import, all token IDs are regenerated to avoid UUID conflicts with existing tokens on the map.

```typescript
interface PartyFile {
  version: string
  savedAt: string
  tokens: Token[]
}
```

### Fog Ops

Fog operations are stored as a flat array and replayed in order. The `reset` and `reveal-all` ops collapse all previous ops when accumulating — only ops after the last baseline op are replayed.

```typescript
type FogOp =
  | { type: 'reveal-circle'; x: number; y: number; radius: number }
  | { type: 'hide-circle';   x: number; y: number; radius: number }
  | { type: 'reveal-polygon'; points: number[] }  // flat [x0,y0, x1,y1, ...]
  | { type: 'reset' }       // fill fog solid black
  | { type: 'reveal-all' }  // clear fog entirely (fully transparent)
```

When a `fogSnapshot` is present in `GameState`, it serves as the base layer in place of the initial solid-black fill. New fog ops are applied on top.

All coordinates are in **map space** (pixels at the map image's native resolution), not screen space. This makes ops resolution-independent and correct regardless of zoom level.

---

## 14. Tool System

The DM has six tools, cycled with **Tab** or selected directly:

| Key | Tool | Behaviour |
|---|---|---|
| V | `select` | **Default.** Context-sensitive — see below |
| R | `fog-reveal` | Paint transparent holes in fog |
| H | `fog-hide` | Paint fog back |
| T | `token-move` | Click to select, drag to move tokens |
| P | `pan` | Click-drag to pan the map |
| L | `laser` | Show a laser pointer dot to players |

Tool shortcuts are suppressed when focus is in a text input (`<input>`, `<textarea>`, `<select>`).

### Smart Select (`select`)

The default tool resolves its action based on what the user interacts with and which modifier keys are held:

| Gesture | Action |
|---|---|
| Drag a token | Move the token |
| Drag empty map | Pan the map |
| Ctrl + drag | Reveal fog (brush ring shown) |
| Shift + drag | Hide fog (brush ring shown) |

### Right-Click Laser Pointer

Right-clicking and dragging activates the laser pointer **regardless of the currently active tool**. The system cursor's context menu is suppressed with `onContextMenu preventDefault`. The laser clears automatically on mouse-up or when the pointer leaves the canvas.

The laser radius and color are configured in the Laser tool's sidebar options and apply to both the dedicated tool and right-click activation.

### Fog Painting — Stroke Interpolation

During a drag, the mouse position is sampled on each `pointermove` event. To prevent gaps between samples (especially at high speed), ops are interpolated between the previous paint position and the current one. The step size is `radius × 0.4`, so at any brush size the circles overlap enough to produce a continuous stroke.

```
step = radius * 0.4
distance = dist(last, current)
if distance > step:
    insert ceil(distance / step) interpolated ops
```

All interpolated and actual ops are accumulated in `strokeBufferRef` and applied directly to the local fog texture for immediate visual feedback. They are only sent via IPC on `pointerup`.

### Brush Cursor

The system cursor is hidden (`cursor: none`) during fog painting. A custom `Graphics` object drawn in screen space shows a ring at the cursor position — green for reveal, red for hide (with a crosshair). The ring scales with zoom so it always represents the true brush size on the map.

In Smart Select mode, the brush ring only appears when a modifier key is held (Ctrl = green, Shift = red), or while a fog stroke is actively in progress.

---

## 15. Debug Mode

Running `npm run dev:debug` sets `FOG_DEBUG_STATE=1` and launches the app with a pre-populated game state, bypassing the need for a save file or real map image.

`src/main/debugState.ts` exports a single `applyDebugState()` function called from `index.ts` before `createDMWindow()`. It populates the authoritative `gameState` directly (same mutation functions used by IPC handlers) and primes `sseMapDataUrlCache` so browser players receive the map immediately on connect.

**Generated state:**

- **Map** — 1920×1080 SVG checkerboard (60 px cells, grey/white) embedded as a `data:image/svg+xml` URL
- **Fog** — fully revealed (`reveal-all` op)
- **Tokens:**

| Name | Type | Position | HP | AC |
|---|---|---|---|---|
| Aldric | Player | col 5, row 3 | 52/52 | 18 |
| Seraphina | Player | col 5, row 9 | 31/31 | 15 |
| Torvin | Player | col 5, row 14 | 44/44 | 16 |
| Goblin Warchief | Enemy | col 27, row 3 | 21/21 | 17 |
| Orc Berserker | Enemy | col 27, row 9 | 52/52 | 13 |
| Skeleton Archer | Enemy | col 27, row 14 | 13/13 | 13 |
| Mira | NPC | col 14, row 7 | 8/8 | 10 |
| Aldous | NPC | col 17, row 11 | 6/6 | 10 |

Grid cell size is 60 px, so token positions are `col × 60 + 30`, `row × 60 + 30` in map space.
