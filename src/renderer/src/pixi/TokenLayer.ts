import { Container, Graphics, ImageSource, Sprite, Text, TextStyle, Texture } from 'pixi.js'
import type { Token, TokenSize, TokenStatus } from '../types'

const DEFAULT_TOKEN_RADIUS = 20
const DEFAULT_LABEL_SIZE = 14

const TYPE_COLORS: Record<Token['type'], number> = {
  player: 0x4a9eff,
  npc: 0x4caf50,
  enemy: 0xe53935,
}

const SIZE_MULTIPLIERS: Record<TokenSize, number> = {
  tiny:       0.4,
  small:      0.75,
  medium:     1.0,
  large:      2.0,
  huge:       3.0,
  gargantuan: 4.0,
}

interface TokenSprite {
  container: Container
  turnOutline: Graphics  // amber ring — active battle turn
  outline: Graphics      // green ring — DM selection
  circle: Graphics
  statusGraphic: Graphics
  statusLabel: Text
  avatarText: Text       // emoji display; hidden when no emoji avatar
  avatarSprite: Sprite | null   // image display; null when no image avatar
  avatarMask: Graphics | null   // circular clip mask for avatarSprite
  avatar: string | null  // current avatar value mirrored from token
  label: Text
  color: number
  status: TokenStatus
  type: Token['type']
  size: TokenSize
}

const SELECTION_COLOR = 0x00e676
const SELECTION_WIDTH = 3
const TURN_COLOR = 0xf59e0b
const TURN_WIDTH = 3

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
  private labelHiddenTypes: Record<Token['type'], boolean> = { player: false, npc: false, enemy: false }
  private hoveredId: string | null = null
  private selectedId: string | null = null
  private activeTurnId: string | null = null

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

  private effectiveRadius(size: TokenSize): number {
    return this.radius * SIZE_MULTIPLIERS[size]
  }

  setPlayerView(value: boolean): void {
    this.isPlayerView = value
  }

  setRadius(r: number): void {
    if (r === this.radius) return
    this.radius = r
    for (const [id, sprite] of this.sprites) {
      this.drawCircle(sprite)
      this.drawTurnOutline(sprite, id === this.activeTurnId)
      this.drawOutline(sprite, id === this.selectedId)
      sprite.label.y = -(this.effectiveRadius(sprite.size) + 10)
    }
  }

  setActiveTurnToken(id: string | null): void {
    if (id === this.activeTurnId) return
    const prev = this.activeTurnId
    this.activeTurnId = id
    if (prev) {
      const s = this.sprites.get(prev)
      if (s) this.drawTurnOutline(s, false)
    }
    if (id) {
      const s = this.sprites.get(id)
      if (s) this.drawTurnOutline(s, true)
    }
  }

  private drawTurnOutline(sprite: TokenSprite, active: boolean): void {
    sprite.turnOutline.clear()
    if (active) {
      const r = this.effectiveRadius(sprite.size) + TURN_WIDTH + 1 + SELECTION_WIDTH + 2
      sprite.turnOutline.circle(0, 0, r).stroke({ color: TURN_COLOR, width: TURN_WIDTH })
    }
  }

  setSelectedToken(id: string | null): void {
    if (id === this.selectedId) return
    const prev = this.selectedId
    this.selectedId = id
    if (prev) {
      const s = this.sprites.get(prev)
      if (s) this.drawOutline(s, false)
    }
    if (id) {
      const s = this.sprites.get(id)
      if (s) this.drawOutline(s, true)
    }
  }

  private drawOutline(sprite: TokenSprite, selected: boolean): void {
    sprite.outline.clear()
    if (selected) {
      const r = this.effectiveRadius(sprite.size) + SELECTION_WIDTH + 1
      sprite.outline.circle(0, 0, r).stroke({ color: SELECTION_COLOR, width: SELECTION_WIDTH })
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

  setLabelHiddenTypes(types: Record<Token['type'], boolean>): void {
    this.labelHiddenTypes = types
    this.reconcileLabelVisibility()
  }

  /** Show a single token's label on hover when its label is normally hidden (DM only). */
  setHoveredToken(id: string | null): void {
    if (id === this.hoveredId) return
    this.hoveredId = id
    this.reconcileLabelVisibility()
  }

  private reconcileLabelVisibility(): void {
    for (const [id, sprite] of this.sprites) {
      const typeVisible = !this.labelHiddenTypes[sprite.type]
      sprite.label.visible = (this.labelsVisible && typeVisible) || id === this.hoveredId
    }
  }

  private drawAvatar(sprite: TokenSprite, r: number): void {
    // Destroy any existing image sprite
    if (sprite.avatarSprite) {
      sprite.avatarMask?.destroy()
      sprite.avatarSprite.destroy()
      sprite.avatarSprite = null
      sprite.avatarMask = null
    }
    sprite.avatarText.visible = false

    const { avatar } = sprite
    if (!avatar) return

    if (!avatar.startsWith('data:')) {
      // Emoji branch
      sprite.avatarText.text = avatar
      sprite.avatarText.style = new TextStyle({
        fontSize: r * 1.6,
        fill: 0xffffff,
        dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.6 },
      })
      sprite.avatarText.visible = true
    } else {
      // Image branch — build texture directly to avoid PixiJS asset-cache warnings
      const img = new Image()
      img.src = avatar
      const tex = new Texture({ source: new ImageSource({ resource: img }) })
      const sp = new Sprite(tex)
      sp.anchor.set(0.5, 0.5)
      sp.width = r * 2
      sp.height = r * 2
      const mask = new Graphics()
      mask.circle(0, 0, r).fill(0xffffff)
      sp.mask = mask
      // Insert after circle, before statusGraphic
      const statusIdx = sprite.container.getChildIndex(sprite.statusGraphic)
      sprite.container.addChildAt(mask, statusIdx)
      sprite.container.addChildAt(sp, statusIdx)
      sprite.avatarSprite = sp
      sprite.avatarMask = mask
    }
  }

  /** Redraws the circle and status indicator for a sprite. */
  private drawCircle(sprite: TokenSprite): void {
    const { circle, statusGraphic, color, status } = sprite
    const r = this.effectiveRadius(sprite.size)

    circle.clear()
    if (!sprite.avatar) {
      if (status === 'dead') {
        circle.circle(0, 0, r).fill({ color, alpha: 0.35 })
      } else {
        circle.circle(0, 0, r).fill(color)
      }
    }

    statusGraphic.clear()
    sprite.statusLabel.visible = false

    if (status === 'dsa') {
      // Warning symbol centered over the token
      sprite.statusLabel.style = new TextStyle({
        fontSize: r * 1.4,
        fill: 0xf59e0b,
        fontWeight: 'bold',
        dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.9 },
      })
      sprite.statusLabel.visible = true
    } else if (status === 'dead') {
      // White X through the token
      const x = r * 0.55
      statusGraphic
        .moveTo(-x, -x).lineTo(x, x)
        .moveTo(x, -x).lineTo(-x, x)
        .stroke({ color: 0xffffff, width: 3, alpha: 0.9 })
    }

    this.drawAvatar(sprite, r)
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
    const status: TokenStatus = token.status ?? 'alive'
    const size: TokenSize = token.size ?? 'medium'

    const turnOutline = new Graphics()
    const outline = new Graphics()
    const circle = new Graphics()
    const statusGraphic = new Graphics()
    const statusLabel = new Text({ text: '⚠', style: new TextStyle({ fontSize: this.effectiveRadius(size) * 1.4, fill: 0xf59e0b }) })
    statusLabel.anchor.set(0.5, 0.5)
    statusLabel.visible = false
    const avatarText = new Text({ text: '', style: new TextStyle({ fontSize: this.effectiveRadius(size) * 1.6, fill: 0xffffff }) })
    avatarText.anchor.set(0.5, 0.5)
    avatarText.visible = false
    const label = new Text({ text: token.label, style: this.makeLabelStyle() })
    label.anchor.set(0.5, 0.5)
    label.y = -(this.effectiveRadius(size) + 10)
    label.visible = (this.labelsVisible && !this.labelHiddenTypes[token.type]) || token.id === this.hoveredId

    container.addChild(turnOutline, outline, circle, statusGraphic, statusLabel, avatarText, label)
    this.addChild(container)

    const sprite: TokenSprite = {
      container, turnOutline, outline, circle, statusGraphic, statusLabel,
      avatarText, avatarSprite: null, avatarMask: null, avatar: token.avatar ?? null,
      label, color, status, type: token.type, size,
    }
    this.sprites.set(token.id, sprite)
    this.drawCircle(sprite)
    this.drawTurnOutline(sprite, token.id === this.activeTurnId)
    this.drawOutline(sprite, token.id === this.selectedId)
  }

  private updateSprite(token: Token): void {
    const sprite = this.sprites.get(token.id)!
    sprite.container.x = token.x
    sprite.container.y = token.y
    sprite.color = this.parseColor(token.color) ?? TYPE_COLORS[token.type]
    sprite.status = token.status ?? 'alive'
    sprite.size = token.size ?? 'medium'
    sprite.avatar = token.avatar ?? null
    this.drawCircle(sprite)
    sprite.label.text = token.label
    sprite.label.y = -(this.effectiveRadius(sprite.size) + 10)
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
      if (Math.sqrt(dx * dx + dy * dy) <= this.effectiveRadius(sprite.size)) return id
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
