import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { AreaEffect } from '../types'

export const AREA_EFFECT_PRESETS = {
  burning: { color: '#ff6a00', label: 'Burning' },
  webbed:  { color: '#9b59b6', label: 'Webbed'  },
  frozen:  { color: '#00bfff', label: 'Frozen'  },
  acid:    { color: '#39ff14', label: 'Acid'     },
  custom:  { color: '#ffff00', label: 'Effect'   },
} as const

function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

interface AreaEffectSprite {
  container: Container
  fill: Graphics
  outline: Graphics
  label: Text
  effect: AreaEffect
}

/**
 * Renders area effect overlays (burning, webbed, frozen, acid, etc.) on the map.
 * Follows the same reconcile-pattern as TokenLayer.
 */
export class AreaEffectLayer extends Container {
  private sprites = new Map<string, AreaEffectSprite>()
  private selectedId: string | null = null
  private isPlayerView = false
  private labelSize = 14
  // Ephemeral preview drawn during drag-to-place; always kept as the last child
  private previewGraphics = new Graphics()
  private previewLabel = new Text({
    text: '',
    style: new TextStyle({
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
      dropShadow: { alpha: 0.9, blur: 4, color: 0x000000, distance: 0 },
    }),
  })

  constructor() {
    super()
    this.previewLabel.anchor.set(0.5, 0.5)
    this.previewLabel.visible = false
    this.addChild(this.previewGraphics, this.previewLabel)
  }

  setPlayerView(value: boolean): void {
    this.isPlayerView = value
  }

  setLabelSize(size: number): void {
    if (size === this.labelSize) return
    this.labelSize = size
    for (const sprite of this.sprites.values()) {
      sprite.label.style.fontSize = size
    }
    this.previewLabel.style.fontSize = size
  }

  syncAreaEffects(effects: AreaEffect[]): void {
    const incoming = new Set(effects.map((e) => e.id))

    // Remove sprites for deleted effects
    for (const [id, sprite] of this.sprites) {
      if (!incoming.has(id)) {
        this.removeChild(sprite.container)
        sprite.container.destroy({ children: true })
        this.sprites.delete(id)
      }
    }

    // Add or update
    for (const effect of effects) {
      if (this.isPlayerView && !effect.visibleToPlayers) {
        const existing = this.sprites.get(effect.id)
        if (existing) {
          this.removeChild(existing.container)
          existing.container.destroy({ children: true })
          this.sprites.delete(effect.id)
        }
        continue
      }
      if (this.sprites.has(effect.id)) {
        this.updateSprite(effect)
      } else {
        this.createSprite(effect)
      }
    }

    // Keep preview children on top
    const last = this.children.length - 1
    if (last >= 1) {
      this.setChildIndex(this.previewLabel, last)
      this.setChildIndex(this.previewGraphics, last - 1)
    }
  }

  private createSprite(effect: AreaEffect): void {
    const container = new Container()
    container.x = effect.x
    container.y = effect.y

    const fill = new Graphics()
    const outline = new Graphics()
    const label = new Text({
      text: effect.label,
      style: new TextStyle({
        fontSize: this.labelSize,
        fontWeight: 'bold',
        fill: 0xffffff,
        dropShadow: { alpha: 0.8, blur: 3, color: 0x000000, distance: 1 },
      }),
    })
    label.anchor.set(0.5, 0.5)

    container.addChild(fill, outline, label)

    // Insert before the two preview children (previewGraphics + previewLabel)
    this.addChildAt(container, Math.max(0, this.children.length - 2))

    const sprite: AreaEffectSprite = { container, fill, outline, label, effect }
    this.sprites.set(effect.id, sprite)

    this.drawSprite(sprite, effect, this.selectedId === effect.id)
  }

  private updateSprite(effect: AreaEffect): void {
    const sprite = this.sprites.get(effect.id)
    if (!sprite) return
    sprite.effect = effect
    sprite.container.x = effect.x
    sprite.container.y = effect.y
    this.drawSprite(sprite, effect, this.selectedId === effect.id)
  }

  private drawSprite(sprite: AreaEffectSprite, effect: AreaEffect, selected: boolean): void {
    const color = parseColor(effect.color)

    // Fill
    sprite.fill.clear()
    if (effect.shape === 'circle') {
      sprite.fill.circle(0, 0, effect.radius).fill({ color, alpha: effect.opacity })
    } else {
      sprite.fill
        .rect(-effect.radius, -effect.height, effect.radius * 2, effect.height * 2)
        .fill({ color, alpha: effect.opacity })
    }

    // Selection outline
    sprite.outline.clear()
    if (selected) {
      if (effect.shape === 'circle') {
        sprite.outline.circle(0, 0, effect.radius + 3).stroke({ color: 0xffffff, width: 2, alpha: 0.9 })
      } else {
        sprite.outline
          .rect(-(effect.radius + 3), -(effect.height + 3), (effect.radius + 3) * 2, (effect.height + 3) * 2)
          .stroke({ color: 0xffffff, width: 2, alpha: 0.9 })
      }
    }

    // Label
    sprite.label.text = effect.label
  }

  setSelected(id: string | null): void {
    const prev = this.selectedId
    this.selectedId = id

    if (prev) {
      const s = this.sprites.get(prev)
      if (s) this.drawSprite(s, s.effect, false)
    }
    if (id) {
      const s = this.sprites.get(id)
      if (s) this.drawSprite(s, s.effect, true)
    }
  }

  hitTest(x: number, y: number): string | null {
    // Iterate in reverse so topmost (most recently added) wins
    const ids = [...this.sprites.keys()].reverse()
    for (const id of ids) {
      const { effect } = this.sprites.get(id)!
      const dx = x - effect.x
      const dy = y - effect.y
      if (effect.shape === 'circle') {
        if (Math.sqrt(dx * dx + dy * dy) <= effect.radius) return id
      } else {
        if (Math.abs(dx) <= effect.radius && Math.abs(dy) <= effect.height) return id
      }
    }
    return null
  }

  showPreview(
    x: number, y: number,
    radius: number, height: number,
    shape: 'circle' | 'rect',
    color: string,
    opacity: number,
    sizeLabel: string,
  ): void {
    const c = parseColor(color)
    this.previewGraphics.clear()
    if (shape === 'circle') {
      this.previewGraphics
        .circle(x, y, radius)
        .fill({ color: c, alpha: opacity })
        .circle(x, y, radius)
        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 })
    } else {
      this.previewGraphics
        .rect(x - radius, y - height, radius * 2, height * 2)
        .fill({ color: c, alpha: opacity })
        .rect(x - radius, y - height, radius * 2, height * 2)
        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 })
    }
    this.previewLabel.text = sizeLabel
    this.previewLabel.x = x
    this.previewLabel.y = y
    this.previewLabel.visible = true
  }

  clearPreview(): void {
    this.previewGraphics.clear()
    this.previewLabel.visible = false
  }
}
