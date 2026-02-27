import type { GameState, FogOp, Token, MapInfo, SaveFile } from '../renderer/src/types'

const state: GameState = {
  map: null,
  fogOps: [],
  tokens: [],
  tokenRadius: 20,
  tokenLabelSize: 14,
  tokenLabelVisible: true,
}

export function getState(): GameState {
  return structuredClone(state)
}

export function setMap(map: MapInfo): void {
  state.map = map
  // Reset fog when a new map is loaded
  state.fogOps = []
}

export function addFogOps(ops: FogOp[]): void {
  for (const op of ops) addFogOp(op)
}

export function addFogOp(op: FogOp): void {
  if (op.type === 'reset') {
    state.fogOps = [op]
  } else {
    // If the last op was a reset, replace it to keep the list lean
    const last = state.fogOps[state.fogOps.length - 1]
    if (last?.type === 'reset') {
      state.fogOps = [op]
    } else {
      state.fogOps.push(op)
    }
  }
}

export function resetFog(): void {
  state.fogOps = []
}

export function addToken(token: Token): void {
  state.tokens.push(token)
}

export function updateToken(updated: Token): void {
  const idx = state.tokens.findIndex((t) => t.id === updated.id)
  if (idx !== -1) state.tokens[idx] = updated
}

export function removeToken(id: string): void {
  state.tokens = state.tokens.filter((t) => t.id !== id)
}

export function setTokenRadius(r: number): void {
  state.tokenRadius = r
}

export function setTokenLabelSize(size: number): void {
  state.tokenLabelSize = size
}

export function setTokenLabelVisible(visible: boolean): void {
  state.tokenLabelVisible = visible
}

export function loadSave(save: SaveFile): void {
  state.map = save.map
  state.fogOps = save.fogOps
  state.tokens = save.tokens
  state.tokenRadius = save.tokenRadius
  state.tokenLabelSize = save.tokenLabelSize
  state.tokenLabelVisible = save.tokenLabelVisible
}
