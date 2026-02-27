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
}

// A single fog operation - stored as a list so we can replay on new windows
export type FogOp =
  | { type: 'reveal-circle'; x: number; y: number; radius: number }
  | { type: 'hide-circle'; x: number; y: number; radius: number }
  | { type: 'reveal-polygon'; points: number[] } // flat [x0,y0, x1,y1, ...]
  | { type: 'reset' }

export interface MapInfo {
  dataUrl: string // base64 data URL
  name: string
  width: number // natural image width in pixels
  height: number // natural image height in pixels
}

export interface PlayerViewport {
  x: number
  y: number
  scale: number
}

export interface GameState {
  map: MapInfo | null
  fogOps: FogOp[]
  tokens: Token[]
  tokenRadius: number
  tokenLabelSize: number
  tokenLabelVisible: boolean
  playerViewport: PlayerViewport | null
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
} as const
