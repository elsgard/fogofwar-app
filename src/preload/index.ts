import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../renderer/src/types'
import type { FogOp, Token, MapInfo, GameState, PlayerViewport } from '../renderer/src/types'

const api = {
  getState: (): Promise<GameState> => ipcRenderer.invoke(IPC.GET_STATE),

  loadMap: (): Promise<{ dataUrl: string; name: string; ext: string } | null> =>
    ipcRenderer.invoke(IPC.LOAD_MAP),

  commitMap: (mapInfo: MapInfo): void =>
    ipcRenderer.send(IPC.LOAD_MAP + ':commit', mapInfo),

  addFogOp: (op: FogOp): void => ipcRenderer.send(IPC.ADD_FOG_OP, op),
  batchFogOps: (ops: FogOp[]): void => ipcRenderer.send(IPC.BATCH_FOG_OPS, ops),

  resetFog: (): void => ipcRenderer.send(IPC.RESET_FOG),

  addToken: (token: Token): void => ipcRenderer.send(IPC.ADD_TOKEN, token),

  updateToken: (token: Token): void => ipcRenderer.send(IPC.UPDATE_TOKEN, token),

  removeToken: (id: string): void => ipcRenderer.send(IPC.REMOVE_TOKEN, id),

  setTokenRadius: (r: number): void => ipcRenderer.send(IPC.SET_TOKEN_RADIUS, r),
  setTokenLabelSize: (size: number): void => ipcRenderer.send(IPC.SET_TOKEN_LABEL_SIZE, size),
  setTokenLabelVisible: (visible: boolean): void => ipcRenderer.send(IPC.SET_TOKEN_LABEL_VISIBLE, visible),

  saveScene: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.SAVE_SCENE),

  loadScene: (): Promise<{ success: boolean; cancelled?: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.LOAD_SCENE),

  setPlayerViewport: (vp: PlayerViewport | null): void =>
    ipcRenderer.send(IPC.SET_PLAYER_VIEWPORT, vp),

  openPlayerWindow: (): void => ipcRenderer.send(IPC.OPEN_PLAYER_WINDOW),

  onStateUpdate: (cb: (state: GameState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: GameState): void => cb(state)
    ipcRenderer.on(IPC.STATE_UPDATE, handler)
    return () => ipcRenderer.off(IPC.STATE_UPDATE, handler)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
