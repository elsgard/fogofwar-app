import { create } from 'zustand'
import type { GameState, FogOp, Token, MapInfo } from '../types'

interface GameStore extends GameState {
  // Local UI state
  activeTool: 'fog-reveal' | 'fog-hide' | 'token-move' | 'pan'
  brushRadius: number
  selectedTokenId: string | null

  // Setters driven by IPC state updates
  applyState: (state: GameState) => void

  // Actions that also send IPC messages
  loadMap: () => Promise<void>
  addFogOp: (op: FogOp) => void
  commitStroke: (ops: FogOp[]) => void
  resetFog: () => void
  addToken: (token: Omit<Token, 'id'>) => void
  updateToken: (token: Token) => void
  removeToken: (id: string) => void

  // Local-only UI actions
  setActiveTool: (tool: GameStore['activeTool']) => void
  setBrushRadius: (r: number) => void
  setTokenRadius: (r: number) => void
  setTokenLabelSize: (size: number) => void
  setTokenLabelVisible: (visible: boolean) => void
  setSelectedTokenId: (id: string | null) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  // GameState
  map: null,
  fogOps: [],
  tokens: [],

  // UI state
  activeTool: 'fog-reveal',
  brushRadius: 60,
  tokenRadius: 20,
  tokenLabelSize: 14,
  tokenLabelVisible: true,
  selectedTokenId: null,

  applyState: (state) => set((s) => ({
      // SSE lite updates omit map.dataUrl (empty string) to keep payloads small.
      // Three cases:
      //   no map at all         → clear map
      //   map with dataUrl      → full update; keep existing ref if dataUrl unchanged
      //   map with empty dataUrl → lite SSE update; keep the existing map object
      map: !state.map
        ? null
        : state.map.dataUrl
          ? (s.map?.dataUrl === state.map.dataUrl ? s.map : state.map)
          : s.map,
      fogOps: state.fogOps,
      tokens: state.tokens,
      tokenRadius: state.tokenRadius,
      tokenLabelSize: state.tokenLabelSize,
      tokenLabelVisible: state.tokenLabelVisible,
  })),

  loadMap: async () => {
    const result = await window.api.loadMap()
    if (!result) return

    // Measure natural image dimensions before committing
    const img = new Image()
    img.src = result.dataUrl
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
    })

    const mapInfo: MapInfo = {
      dataUrl: result.dataUrl,
      name: result.name,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }

    window.api.commitMap(mapInfo)
    // Optimistic local update — main will also broadcast state
    set({ map: mapInfo, fogOps: [] })
  },

  addFogOp: (op) => {
    window.api.addFogOp(op)
    // Optimistic update
    set((s) => ({
      fogOps: op.type === 'reset' ? [op] : [...s.fogOps, op],
    }))
  },

  commitStroke: (ops) => {
    if (ops.length === 0) return
    window.api.batchFogOps(ops)
    // Optimistic update — append the whole stroke at once
    set((s) => ({ fogOps: [...s.fogOps, ...ops] }))
  },

  resetFog: () => {
    window.api.resetFog()
    set({ fogOps: [] })
  },

  addToken: (partial) => {
    const token: Token = {
      ...partial,
      id: crypto.randomUUID(),
    }
    window.api.addToken(token)
    set((s) => ({ tokens: [...s.tokens, token] }))
  },

  updateToken: (token) => {
    window.api.updateToken(token)
    set((s) => ({ tokens: s.tokens.map((t) => (t.id === token.id ? token : t)) }))
  },

  removeToken: (id) => {
    window.api.removeToken(id)
    set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) }))
    if (get().selectedTokenId === id) set({ selectedTokenId: null })
  },

  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushRadius: (brushRadius) => set({ brushRadius }),
  setTokenRadius: (tokenRadius) => {
    window.api?.setTokenRadius(tokenRadius)
    set({ tokenRadius })
  },
  setTokenLabelSize: (tokenLabelSize) => {
    window.api?.setTokenLabelSize(tokenLabelSize)
    set({ tokenLabelSize })
  },
  setTokenLabelVisible: (tokenLabelVisible) => {
    window.api?.setTokenLabelVisible(tokenLabelVisible)
    set({ tokenLabelVisible })
  },
  setSelectedTokenId: (selectedTokenId) => set({ selectedTokenId }),
}))
