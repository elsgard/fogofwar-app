import { Container, Sprite, Texture } from 'pixi.js'

/**
 * Renders the background map image.
 */
export class MapLayer extends Container {
  private sprite: Sprite | null = null
  private _mapWidth = 0
  private _mapHeight = 0

  async setMap(dataUrl: string, width: number, height: number): Promise<void> {
    // Load the image before touching the existing sprite so there's no blank frame.
    const img = new Image()
    img.src = dataUrl
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load map image'))
    })

    // Swap old sprite out only once the new texture is ready.
    if (this.sprite) {
      this.removeChild(this.sprite)
      this.sprite.destroy({ texture: true })
      this.sprite = null
    }

    this._mapWidth = width
    this._mapHeight = height

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
