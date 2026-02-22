export type TokenType = 'player' | 'npc' | 'enemy'

export interface Token {
  id: string
  type: TokenType
  x: number // map-space pixels (before zoom/pan)
  y: number
  label: string
  color: string
  visibleToPlayers: boolean
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

export interface GameState {
  map: MapInfo | null
  fogOps: FogOp[]
  tokens: Token[]
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
  STATE_UPDATE: 'game:state-update', // main → renderer broadcast
} as const
