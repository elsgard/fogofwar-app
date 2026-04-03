/**
 * Debug state generator — used when FOG_DEBUG_STATE=1 is set.
 * Pre-populates the game state with a generated checkerboard map and a handful
 * of tokens (players, enemies, NPCs) so the app is immediately usable for
 * testing without needing a real save file or image.
 */
import * as gs from './gameState'
import type { Token, TokenSize, AreaEffect } from '../renderer/src/types'

const CELL = 60  // grid cell size in pixels
const MAP_W = 1920
const MAP_H = 1080

/** Returns the map-space center of grid cell (col, row). */
function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 }
}

function generateGridMapDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}">
  <defs>
    <pattern id="checker" width="${CELL * 2}" height="${CELL * 2}" patternUnits="userSpaceOnUse">
      <rect width="${CELL}" height="${CELL}" fill="#cccccc"/>
      <rect x="${CELL}" width="${CELL}" height="${CELL}" fill="#f2f2f2"/>
      <rect y="${CELL}" width="${CELL}" height="${CELL}" fill="#f2f2f2"/>
      <rect x="${CELL}" y="${CELL}" width="${CELL}" height="${CELL}" fill="#cccccc"/>
    </pattern>
    <pattern id="grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">
      <path d="M ${CELL} 0 L 0 0 0 ${CELL}" fill="none" stroke="#999" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="${MAP_W}" height="${MAP_H}" fill="url(#checker)"/>
  <rect width="${MAP_W}" height="${MAP_H}" fill="url(#grid)"/>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function makeToken(
  id: string,
  label: string,
  type: Token['type'],
  color: string,
  col: number,
  row: number,
  hp: number,
  hpMax: number,
  ac: number,
  size: TokenSize = 'medium',
  avatar?: string,
): Token {
  const { x, y } = cellCenter(col, row)
  return { id, type, label, color, x, y, visibleToPlayers: true, status: 'alive', hp, hpMax, ac, size, ...(avatar ? { avatar } : {}) }
}

export function applyDebugState(): void {
  // Map: 1920×1080, 32×18 grid cells of 60 px each
  gs.setMap({
    dataUrl: generateGridMapDataUrl(),
    name: 'Debug Grid (1920×1080)',
    width: MAP_W,
    height: MAP_H,
  })

  // Map scale: 60px cell = 5 ft → 12 px/ft
  gs.setMapScale({ pixelsPerFoot: 12 })

  // Reveal only the left ~quarter of the map — players are visible, enemies are in fog
  gs.addFogOp({ type: 'reveal-circle', x: 240, y: 540, radius: 600 })

  // Players — left quarter of the map (column 5), spread vertically
  gs.addToken(makeToken('debug-player-1', 'Aldric',    'player', '#4a9eff', 5, 3,  52, 52, 18, 'medium', '🧙'))
  gs.addToken(makeToken('debug-player-2', 'Seraphina', 'player', '#4a9eff', 5, 9,  31, 31, 15, 'medium', '🛡️'))
  gs.addToken(makeToken('debug-player-3', 'Torvin',    'player', '#4a9eff', 5, 14, 44, 44, 16, 'medium', '⚔️'))

  // Enemies — right quarter of the map (column 27), spread vertically
  gs.addToken(makeToken('debug-enemy-1', 'Goblin Warchief', 'enemy', '#e53935', 27, 3,  21, 21, 17, 'small'))
  gs.addToken(makeToken('debug-enemy-2', 'Orc Berserker',   'enemy', '#e53935', 27, 9,  52, 52, 13, 'large'))
  gs.addToken(makeToken('debug-enemy-3', 'Skeleton Archer', 'enemy', '#e53935', 27, 14, 13, 13, 13, 'medium', '💀'))

  // NPCs — center of the map (hidden under fog in player view)
  gs.addToken(makeToken('debug-npc-1', 'Mira',   'npc', '#f59e0b', 14, 7,  8, 8, 10))
  gs.addToken(makeToken('debug-npc-2', 'Aldous', 'npc', '#f59e0b', 17, 11, 6, 6, 10))

  // Area effects — in the enemy zone (hidden under fog in player view)
  const ae1: AreaEffect = {
    id: 'debug-ae-1',
    kind: 'burning',
    shape: 'circle',
    x: cellCenter(27, 9).x,
    y: cellCenter(27, 9).y,
    radius: 90,
    height: 90,
    color: '#ff6a00',
    label: 'Burning',
    opacity: 0.45,
    visibleToPlayers: true,
  }
  const ae2: AreaEffect = {
    id: 'debug-ae-2',
    kind: 'webbed',
    shape: 'rect',
    x: cellCenter(22, 3).x,
    y: cellCenter(22, 3).y,
    radius: 120,
    height: 60,
    color: '#9b59b6',
    label: 'Webbed',
    opacity: 0.45,
    visibleToPlayers: true,
  }
  gs.addAreaEffect(ae1)
  gs.addAreaEffect(ae2)
}
