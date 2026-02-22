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
  selectedTokenId: null,

  applyState: (state) => set((s) => ({
    // Keep the existing map reference when the image hasn't changed so that
    // MapCanvas's map useEffect (which depends on [map]) doesn't re-fire on
    // every state broadcast. A new structuredClone reference with the same
    // dataUrl would otherwise trigger an async fogLayer.init() reset on every
    // fog-op update, corrupting prevFogOpsLenRef and causing the browser player
    // to always render one stroke behind.
    map: s.map?.dataUrl === state.map?.dataUrl ? s.map : state.map,
    fogOps: state.fogOps,
    tokens: state.tokens,
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
  setSelectedTokenId: (selectedTokenId) => set({ selectedTokenId }),
}))
