import { Container, Sprite, Texture } from 'pixi.js'

/**
 * Renders the background map image.
 */
export class MapLayer extends Container {
  private sprite: Sprite | null = null
  private _mapWidth = 0
  private _mapHeight = 0

  async setMap(dataUrl: string, width: number, height: number): Promise<void> {
    if (this.sprite) {
      this.removeChild(this.sprite)
      this.sprite.destroy({ texture: true })
      this.sprite = null
    }

    // Store dimensions before async load so fitWorld() can use them immediately.
    this._mapWidth = width
    this._mapHeight = height

    // Load via HTMLImageElement (governed by img-src CSP, not connect-src).
    // This ensures the image is fully decoded before we create the texture,
    // avoiding the 1×1 white placeholder that Texture.from(url) returns initially.
    const img = new Image()
    img.src = dataUrl
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load map image'))
    })

    const texture = Texture.from(img)
    this.sprite = new Sprite(texture)
    this.sprite.width = width
    this.sprite.height = height
    this.addChild(this.sprite)
  }

  clearMap(): void {
    if (this.sprite) {
      this.removeChild(this.sprite)
      this.sprite.destroy({ texture: true })
      this.sprite = null
    }
    this._mapWidth = 0
    this._mapHeight = 0
  }

  get mapWidth(): number {
    return this._mapWidth
  }

  get mapHeight(): number {
    return this._mapHeight
  }
}
