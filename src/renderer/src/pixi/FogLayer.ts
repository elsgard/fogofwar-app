import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js'
import type { FogOp } from '../types'

/**
 * Renders the fog-of-war overlay.
 *
 * Strategy: a RenderTexture starts fully black (fog). Reveal ops punch
 * transparent holes with the 'erase' blend mode so the map shows through.
 * Hide ops draw opaque black back with 'normal' blend mode to re-fog an area.
 * The op list is replayed identically on every window (DM + Player).
 */
export class FogLayer extends Container {
  private fogTexture: RenderTexture | null = null
  private fogSprite: Sprite | null = null
  private renderer: Renderer | null = null
  // Gradient textures cached by radius so we don't rebuild them every frame
  private featherCache = new Map<number, Texture>()

  fogAlpha = 0.92

  init(renderer: Renderer, mapWidth: number, mapHeight: number): void {
    this.cleanup()
    this.renderer = renderer

    this.fogTexture = RenderTexture.create({ width: mapWidth, height: mapHeight })
    this.fillBlack()

    this.fogSprite = new Sprite(this.fogTexture)
    this.fogSprite.alpha = this.fogAlpha
    this.addChild(this.fogSprite)
  }

  setAlpha(alpha: number): void {
    this.fogAlpha = alpha
    if (this.fogSprite) this.fogSprite.alpha = alpha
  }

  /**
   * Rebuild the fog texture from scratch by replaying all ops.
   * Called on initial load and on IPC state sync.
   */
  applyOps(ops: FogOp[]): void {
    if (!this.fogTexture || !this.renderer) return
    this.fillBlack()

    // Find the last reset and only replay ops after it
    let start = 0
    for (let i = ops.length - 1; i >= 0; i--) {
      if (ops[i].type === 'reset') { start = i + 1; break }
    }
    for (let i = start; i < ops.length; i++) {
      this.drawOp(ops[i])
    }
  }

  /**
   * Apply a single op incrementally on top of the current texture.
   * Only call this when appending to an already-synced texture.
   */
  applyOneOp(op: FogOp): void {
    if (!this.fogTexture || !this.renderer) return
    if (op.type === 'reset') { this.fillBlack(); return }
    this.drawOp(op)
  }

  private fillBlack(): void {
    if (!this.fogTexture || !this.renderer) return
    const g = new Graphics().rect(0, 0, this.fogTexture.width, this.fogTexture.height).fill(0x000000)
    this.renderer.render({ container: g, target: this.fogTexture })
    g.destroy()
  }

  /**
   * Returns a white radial-gradient texture for the given radius.
   * The inner 65% is fully opaque; the outer 35% fades to transparent.
   * Cached per radius so it's only built once.
   */
  private getFeatherTexture(radius: number): Texture {
    const cached = this.featherCache.get(radius)
    if (cached) return cached

    const diameter = Math.ceil(radius * 2)
    const canvas = document.createElement('canvas')
    canvas.width = diameter
    canvas.height = diameter
    const ctx = canvas.getContext('2d')!

    const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)
    grad.addColorStop(0,    'rgba(255,255,255,1)')
    grad.addColorStop(0.65, 'rgba(255,255,255,1)')
    grad.addColorStop(1,    'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, diameter, diameter)

    const texture = Texture.from(canvas)
    this.featherCache.set(radius, texture)
    return texture
  }

  private drawOp(op: FogOp): void {
    if (!this.fogTexture || !this.renderer) return

    if (op.type === 'hide-circle') {
      // Draw a black radial gradient back onto the fog texture (re-fogs with soft edge).
      const texture = this.getFeatherTexture(op.radius)
      const sprite = new Sprite(texture)
      sprite.tint = 0x000000
      sprite.anchor.set(0.5)
      sprite.position.set(op.x, op.y)
      this.renderer.render({ container: sprite, target: this.fogTexture, clear: false })
      sprite.destroy({ texture: false })
      return
    }

    // Reveal ops: punch a feathered transparent hole using the erase blend mode.
    // In PixiJS v8, the erase blend mode only works correctly when the erase
    // container is a non-root child in the render call — setting it on the root
    // container passed to renderer.render() is ignored. We wrap it in a plain
    // root container so the erase group is processed as a layer group.
    if (op.type === 'reveal-circle') {
      const texture = this.getFeatherTexture(op.radius)
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.position.set(op.x, op.y)

      const eraseGroup = new Container()
      eraseGroup.blendMode = 'erase'
      eraseGroup.addChild(sprite)
      const root = new Container()
      root.addChild(eraseGroup)
      this.renderer.render({ container: root, target: this.fogTexture, clear: false })
      eraseGroup.removeChild(sprite)
      sprite.destroy({ texture: false })
      eraseGroup.destroy()
      root.destroy()
      return
    }

    if (op.type === 'reveal-polygon') {
      if (op.points.length < 6) return
      const g = new Graphics()
      g.poly(op.points).fill({ color: 0xffffff, alpha: 1 })
      const eraseGroup = new Container()
      eraseGroup.blendMode = 'erase'
      eraseGroup.addChild(g)
      const root = new Container()
      root.addChild(eraseGroup)
      this.renderer.render({ container: root, target: this.fogTexture, clear: false })
      root.destroy({ children: true })
    }
  }

  cleanup(): void {
    if (this.fogSprite) {
      this.removeChild(this.fogSprite)
      this.fogSprite.destroy()
      this.fogSprite = null
    }
    if (this.fogTexture) {
      this.fogTexture.destroy(true)
      this.fogTexture = null
    }
    for (const tex of this.featherCache.values()) tex.destroy(true)
    this.featherCache.clear()
    this.renderer = null
  }

  get isReady(): boolean {
    return this.fogTexture !== null
  }
}
