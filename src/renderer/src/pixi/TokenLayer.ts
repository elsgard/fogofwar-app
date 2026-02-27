import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { Token } from '../types'

const DEFAULT_TOKEN_RADIUS = 20
const DEFAULT_LABEL_SIZE = 14

const TYPE_COLORS: Record<Token['type'], number> = {
  player: 0x4a9eff,
  npc: 0x4caf50,
  enemy: 0xe53935,
}

interface TokenSprite {
  container: Container
  circle: Graphics
  label: Text
  color: number
}

/**
 * Manages token sprites on the map.
 * In player view, tokens with visibleToPlayers=false are hidden.
 */
export class TokenLayer extends Container {
  private sprites = new Map<string, TokenSprite>()
  private isPlayerView = false
  private radius = DEFAULT_TOKEN_RADIUS
  private labelSize = DEFAULT_LABEL_SIZE
  private labelsVisible = true
  private hoveredId: string | null = null

  private makeLabelStyle(): TextStyle {
    return new TextStyle({
      fontSize: this.labelSize,
      fill: 0xffffff,
      fontWeight: 'bold',
      dropShadow: {
        color: 0x000000,
        blur: 2,
        distance: 1,
        alpha: 0.8,
      },
    })
  }

  setPlayerView(value: boolean): void {
    this.isPlayerView = value
  }

  setRadius(r: number): void {
    if (r === this.radius) return
    this.radius = r
    for (const sprite of this.sprites.values()) {
      sprite.circle.clear()
      sprite.circle.circle(0, 0, r).fill(sprite.color)
      sprite.label.y = -(r + 10)
    }
  }

  setLabelSize(size: number): void {
    if (size === this.labelSize) return
    this.labelSize = size
    const style = this.makeLabelStyle()
    for (const sprite of this.sprites.values()) {
      sprite.label.style = style
    }
  }

  setLabelsVisible(visible: boolean): void {
    if (visible === this.labelsVisible) return
    this.labelsVisible = visible
    this.reconcileLabelVisibility()
  }

  /** Show a single token's label on hover when labels are globally hidden (DM only). */
  setHoveredToken(id: string | null): void {
    if (this.labelsVisible || id === this.hoveredId) return
    this.hoveredId = id
    this.reconcileLabelVisibility()
  }

  private reconcileLabelVisibility(): void {
    for (const [id, sprite] of this.sprites) {
      sprite.label.visible = this.labelsVisible || id === this.hoveredId
    }
  }

  syncTokens(tokens: Token[]): void {
    const incoming = new Set(tokens.map((t) => t.id))

    // Remove sprites that are no longer in the list
    for (const [id, sprite] of this.sprites) {
      if (!incoming.has(id)) {
        this.removeChild(sprite.container)
        sprite.container.destroy({ children: true })
        this.sprites.delete(id)
      }
    }

    // Add or update
    for (const token of tokens) {
      if (this.isPlayerView && !token.visibleToPlayers) {
        // Hide or skip invisible tokens in player view
        const existing = this.sprites.get(token.id)
        if (existing) {
          this.removeChild(existing.container)
          existing.container.destroy({ children: true })
          this.sprites.delete(token.id)
        }
        continue
      }

      if (this.sprites.has(token.id)) {
        this.updateSprite(token)
      } else {
        this.createSprite(token)
      }
    }
  }

  private createSprite(token: Token): void {
    const container = new Container()
    container.x = token.x
    container.y = token.y

    const color = this.parseColor(token.color) ?? TYPE_COLORS[token.type]

    const circle = new Graphics()
    circle.circle(0, 0, this.radius).fill(color)

    const label = new Text({ text: token.label, style: this.makeLabelStyle() })
    label.anchor.set(0.5, 0.5)
    label.y = -(this.radius + 10)
    label.visible = this.labelsVisible || token.id === this.hoveredId

    container.addChild(circle, label)
    this.addChild(container)
    this.sprites.set(token.id, { container, circle, label, color })
  }

  private updateSprite(token: Token): void {
    const sprite = this.sprites.get(token.id)!
    sprite.container.x = token.x
    sprite.container.y = token.y

    sprite.color = this.parseColor(token.color) ?? TYPE_COLORS[token.type]
    sprite.circle.clear()
    sprite.circle.circle(0, 0, this.radius).fill(sprite.color)

    sprite.label.text = token.label
  }

  /** Move a token sprite immediately (during drag, before state sync) */
  moveToken(id: string, x: number, y: number): void {
    const sprite = this.sprites.get(id)
    if (sprite) {
      sprite.container.x = x
      sprite.container.y = y
    }
  }

  /** Returns the token id at map coordinates (x, y), or null */
  hitTest(x: number, y: number): string | null {
    for (const [id, sprite] of this.sprites) {
      const dx = x - sprite.container.x
      const dy = y - sprite.container.y
      if (Math.sqrt(dx * dx + dy * dy) <= this.radius) return id
    }
    return null
  }

  private parseColor(color: string): number | null {
    if (!color) return null
    const hex = color.replace('#', '')
    const n = parseInt(hex, 16)
    return isNaN(n) ? null : n
  }
}
