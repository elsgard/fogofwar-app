import { ElectronAPI } from '@electron-toolkit/preload'
import type { FogOp, Token, MapInfo, GameState, PlayerViewport } from '../renderer/src/types'

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
  setTokenRadius: (r: number) => void
  setTokenLabelSize: (size: number) => void
  setTokenLabelVisible: (visible: boolean) => void
  saveScene: () => Promise<{ success: boolean; error?: string }>
  loadScene: () => Promise<{ success: boolean; cancelled?: boolean; error?: string }>
  setPlayerViewport: (vp: PlayerViewport | null) => void
  openPlayerWindow: () => void
  openInBrowser: () => void
  onStateUpdate: (cb: (state: GameState) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: FogOfWarAPI
  }
}
