import { Container, Graphics, Text, TextStyle } from 'pixi.js'

// Render the label text at a large internal size so it stays crisp when the
// world is zoomed out. Scale is compensated per draw call to keep apparent
// screen size constant regardless of zoom.
const FONT_SIZE = 180
const TARGET_SCREEN_PX = 18

/**
 * Renders a measurement ruler line in map (world) space.
 * Lives in the world container — inherits pan/zoom automatically.
 * No ticker needed: graphics are redrawn on demand via draw* methods.
 *
 * Pass worldScale (world.scale.x) to each draw call so the label text
 * appears at a fixed pixel size regardless of the current zoom level.
 */
export class MeasurementLayer extends Container {
  private lineGraphic = new Graphics()
  private labelText: Text

  constructor() {
    super()
    this.eventMode = 'none'

    const style = new TextStyle({
      fontSize: FONT_SIZE,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: FONT_SIZE * 0.15 },
      fontFamily: 'monospace',
    })
    this.labelText = new Text({ text: '', style })
    this.labelText.visible = false

    this.addChild(this.lineGraphic, this.labelText)
  }

  /** Compensate the label scale so it appears at TARGET_SCREEN_PX regardless of zoom. */
  private setLabelScale(worldScale: number): void {
    const s = TARGET_SCREEN_PX / (FONT_SIZE * worldScale)
    this.labelText.scale.set(s)
  }

  /** Draw a measurement line from (x1,y1) to (x2,y2) with a distance label. */
  drawMeasure(x1: number, y1: number, x2: number, y2: number, label: string, worldScale: number): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)

    this.lineGraphic.clear()

    if (len < 1) {
      this.labelText.visible = false
      return
    }

    const ux = dx / len
    const uy = dy / len

    // Dashed line
    const DASH = 8
    const GAP = 5
    let pos = 0
    let drawing = true
    this.lineGraphic.moveTo(x1, y1)
    while (pos < len) {
      const segLen = Math.min(drawing ? DASH : GAP, len - pos)
      pos += segLen
      const px = x1 + ux * pos
      const py = y1 + uy * pos
      if (drawing) {
        this.lineGraphic.lineTo(px, py)
      } else {
        this.lineGraphic.moveTo(px, py)
      }
      drawing = !drawing
    }
    this.lineGraphic.stroke({ color: 0xffdd44, width: 2, alpha: 0.9 })

    // Endpoint dots
    this.lineGraphic.circle(x1, y1, 4).fill({ color: 0xffdd44, alpha: 0.9 })
    this.lineGraphic.circle(x2, y2, 4).fill({ color: 0xffdd44, alpha: 0.9 })

    // Label at midpoint, offset by a fixed screen distance perpendicular to the line
    const offset = TARGET_SCREEN_PX / worldScale
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    this.setLabelScale(worldScale)
    this.labelText.text = label
    this.labelText.x = mx + (-uy * offset)
    this.labelText.y = my + (ux * offset)
    this.labelText.anchor.set(0.5, 0.5)
    this.labelText.visible = true
  }

  /** Draw a single anchor dot for the first calibration point, with a hint. */
  drawCalibrationAnchor(x: number, y: number, worldScale: number): void {
    this.lineGraphic.clear()
    this.lineGraphic.circle(x, y, 5).fill({ color: 0x44aaff, alpha: 0.9 })
    this.lineGraphic.circle(x, y, 10).stroke({ color: 0x44aaff, width: 1.5, alpha: 0.6 })

    const offset = TARGET_SCREEN_PX / worldScale
    this.setLabelScale(worldScale)
    this.labelText.text = 'Click second point…'
    this.labelText.x = x + offset
    this.labelText.y = y - offset
    this.labelText.anchor.set(0, 1)
    this.labelText.visible = true
  }

  /** Draw a calibration preview line while the user is hovering toward the second point. */
  drawCalibrationPreview(x1: number, y1: number, x2: number, y2: number, worldScale: number): void {
    this.lineGraphic.clear()
    this.lineGraphic
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ color: 0x44aaff, width: 1.5, alpha: 0.7 })
    this.lineGraphic.circle(x1, y1, 5).fill({ color: 0x44aaff, alpha: 0.9 })
    this.lineGraphic.circle(x2, y2, 5).fill({ color: 0x44aaff, alpha: 0.9 })

    const offset = TARGET_SCREEN_PX / worldScale
    this.setLabelScale(worldScale)
    this.labelText.text = 'How many feet is this?'
    this.labelText.x = (x1 + x2) / 2
    this.labelText.y = (y1 + y2) / 2 - offset
    this.labelText.anchor.set(0.5, 1)
    this.labelText.visible = true
  }

  /** Clear all graphics and hide the label. */
  clear(): void {
    this.lineGraphic.clear()
    this.labelText.visible = false
  }
}
