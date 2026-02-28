import { Container, Graphics } from 'pixi.js'

const TRAIL_DURATION = 1200 // ms until trail fully fades

interface TrailPoint {
  x: number
  y: number
  time: number
  radius: number
  color: number // PixiJS hex number
}

function hexToPixi(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/**
 * Renders a laser pointer dot with a fading trail in map space.
 * Call setPosition() on each pointer move, clearPointer() when done.
 * Wire tick() to the PixiJS app ticker.
 */
export class LaserLayer extends Container {
  private graphic = new Graphics()
  private trail: TrailPoint[] = []
  private active = false

  constructor() {
    super()
    this.eventMode = 'none'
    this.addChild(this.graphic)
  }

  setPosition(x: number, y: number, radius: number, color: string): void {
    this.active = true
    this.trail.push({ x, y, time: Date.now(), radius, color: hexToPixi(color) })
  }

  clearPointer(): void {
    this.active = false
    // Trail continues to fade via tick() — no hard clear
  }

  tick(): void {
    const now = Date.now()
    this.trail = this.trail.filter((p) => now - p.time < TRAIL_DURATION)

    this.graphic.clear()
    if (this.trail.length === 0) return

    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i]
      const age = now - p.time
      const life = 1 - age / TRAIL_DURATION
      const isHead = i === this.trail.length - 1 && this.active

      if (isHead) {
        // Outer glow ring
        this.graphic.circle(p.x, p.y, p.radius * 2.5).fill({ color: p.color, alpha: 0.18 })
        // Main dot
        this.graphic.circle(p.x, p.y, p.radius).fill({ color: p.color, alpha: 0.95 })
        // Bright specular centre
        this.graphic.circle(p.x, p.y, p.radius * 0.35).fill({ color: 0xffffff, alpha: 0.8 })
      } else {
        const r = Math.max(1, p.radius * 0.55 * life)
        this.graphic.circle(p.x, p.y, r).fill({ color: p.color, alpha: life * 0.55 })
      }
    }
  }
}
