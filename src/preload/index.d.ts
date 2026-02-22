import { ElectronAPI } from '@electron-toolkit/preload'
import type { FogOp, Token, MapInfo, GameState } from '../renderer/src/types'

export interface FogOfWarAPI {
  getState: () => Promise<GameState>
  loadMap: () => Promise<{ dataUrl: string; name: string; ext: string } | null>
  commitMap: (mapInfo: MapInfo) => void
  addFogOp: (op: FogOp) => void
  batchFogOps: (ops: FogOp[]) => void
  resetFog: () => void
  addToken: (token: Token) => void
  updateToken: (token: Token) => void
  removeToken: (id: string) => void
  openPlayerWindow: () => void
  onStateUpdate: (cb: (state: GameState) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: FogOfWarAPI
  }
}
