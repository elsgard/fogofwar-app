import type { MonsterSheet } from './monster'

export type { MonsterSheet }

export type TokenType = 'player' | 'npc' | 'enemy'
export type TokenStatus = 'alive' | 'dsa' | 'dead'

export interface Token {
  id: string
  type: TokenType
  x: number // map-space pixels (before zoom/pan)
  y: number
  label: string
  color: string
  visibleToPlayers: boolean
  status?: TokenStatus // optional — undefined means 'alive' (backward compatible)
  hp?: number | null
  hpMax?: number | null
  ac?: number | null
  monsterSheet?: MonsterSheet | null
}

// A single fog operation - stored as a list so we can replay on new windows
export type FogOp =
  | { type: 'reveal-circle'; x: number; y: number; radius: number }
  | { type: 'hide-circle'; x: number; y: number; radius: number }
  | { type: 'reveal-polygon'; points: number[] } // flat [x0,y0, x1,y1, ...]
  | { type: 'reset' }

export interface MapInfo {
  dataUrl: string   // base64 data URL; '' when filePath is used instead
  filePath?: string // absolute path on DM's disk (set when loaded from file dialog)
  name: string
  width: number     // natural image width in pixels
  height: number    // natural image height in pixels
}

export interface PlayerViewport {
  x: number
  y: number
  scale: number
}

// ── Battle Tracker ───────────────────────────────────────────────────────────

export interface Effect {
  id: string
  name: string
  duration: number | null // rounds remaining; null = indefinite
  color: string           // hex, used as a tint swatch
}

export interface Combatant {
  id: string
  name: string
  initiative: number
  initiativeTieBreak: number  // secondary sort key; default 0
  sortOrder: number           // tertiary; for manual reorder within tied groups
  tokenId: string | null      // optional link to a Token on the map
  hp: number | null
  hpMax: number | null
  ac: number | null
  isPlayerCharacter: boolean
  isVisible: boolean          // false = hidden from player initiative strip
  isActive: boolean           // true = it is currently this combatant's turn
  effects: Effect[]
}

export type BattleLogKind =
  | 'round-start'
  | 'turn-start'
  | 'damage'
  | 'heal'
  | 'miss'
  | 'effect-added'
  | 'effect-expired'
  | 'death'
  | 'note'

export interface BattleLogEntry {
  id: string
  round: number
  timestamp: string            // ISO
  kind: BattleLogKind
  text: string                 // pre-formatted display sentence
  combatantId: string | null
  meta: Record<string, number | string | boolean> | null
}

export interface Battle {
  id: string
  name: string
  round: number
  turnDuration: number         // seconds per turn (one combatant's turn), default 6
  isActive: boolean
  combatants: Combatant[]
  log: BattleLogEntry[]
  createdAt: string            // ISO
}

export interface MonsterReveal {
  imgUrl: string
  name: string
}

export interface GameState {
  map: MapInfo | null
  fogOps: FogOp[]
  tokens: Token[]
  tokenRadius: number
  tokenLabelSize: number
  tokenLabelVisible: boolean
  playerViewport: PlayerViewport | null
  battle: Battle | null
  monsterReveal: MonsterReveal | null
}

export interface PartyFile {
  version: string
  savedAt: string // ISO timestamp
  tokens: Token[]
}

export interface SaveFile {
  version: string
  savedAt: string // ISO timestamp
  map: MapInfo | null
  fogOps: FogOp[]
  tokens: Token[]
  tokenRadius: number
  tokenLabelSize: number
  tokenLabelVisible: boolean
  playerViewport: PlayerViewport | null
  battle: Battle | null
}

// IPC channel names as a const object to share between main and preload
export const IPC = {
  LOAD_MAP: 'game:load-map',
  GET_STATE: 'game:get-state',
  ADD_FOG_OP: 'game:add-fog-op',
  BATCH_FOG_OPS: 'game:batch-fog-ops',
  RESET_FOG: 'game:reset-fog',
  ADD_TOKEN: 'game:add-token',
  UPDATE_TOKEN: 'game:update-token',
  REMOVE_TOKEN: 'game:remove-token',
  OPEN_PLAYER_WINDOW: 'game:open-player-window',
  SET_TOKEN_RADIUS: 'game:set-token-radius',
  SET_TOKEN_LABEL_SIZE: 'game:set-token-label-size',
  SET_TOKEN_LABEL_VISIBLE: 'game:set-token-label-visible',
  SET_PLAYER_VIEWPORT: 'game:set-player-viewport',
  SAVE_SCENE: 'game:save-scene',
  LOAD_SCENE: 'game:load-scene',
  STATE_UPDATE: 'game:state-update', // main → renderer broadcast
  OPEN_IN_BROWSER: 'game:open-in-browser',
  LASER_POINTER: 'game:laser-pointer',
  SET_BATTLE: 'game:set-battle',
  SAVE_PARTY: 'game:save-party',
  LOAD_PARTY: 'game:load-party',
  SET_MONSTER_REVEAL: 'game:set-monster-reveal',
} as const
