export interface PhotoEditOptions {
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  brightness?: number
  contrast?: number
  saturation?: number
  removeBackground?: boolean
}

export class PhotoEditorService {
  async editPhoto(imageData: string, options: PhotoEditOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        if (options.crop) {
          canvas.width = options.crop.width
          canvas.height = options.crop.height
          ctx.drawImage(
            img,
            options.crop.x,
            options.crop.y,
            options.crop.width,
            options.crop.height,
            0,
            0,
            options.crop.width,
            options.crop.height
          )
        } else {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
        }

        if (options.brightness || options.contrast || options.saturation) {
          this.applyFilters(ctx, canvas.width, canvas.height, options)
        }

        resolve(canvas.toDataURL('image/jpeg', 0.95))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageData
    })
  }

  private applyFilters(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: PhotoEditOptions
  ) {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    const brightness = options.brightness || 0
    const contrast = options.contrast || 0
    const saturation = options.saturation || 0

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      if (brightness !== 0) {
        r = this.clamp(r + brightness)
        g = this.clamp(g + brightness)
        b = this.clamp(b + brightness)
      }

      if (contrast !== 0) {
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
        r = this.clamp(factor * (r - 128) + 128)
        g = this.clamp(factor * (g - 128) + 128)
        b = this.clamp(factor * (b - 128) + 128)
      }

      if (saturation !== 0) {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b
        r = this.clamp(gray + saturation * (r - gray))
        g = this.clamp(gray + saturation * (g - gray))
        b = this.clamp(gray + saturation * (b - gray))
      }

      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }

    ctx.putImageData(imageData, 0, 0)
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(255, value))
  }

  async removeBackground(imageData: string): Promise<string> {
    return imageData
  }

  async resize(imageData: string, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height
          if (width > height) {
            width = maxWidth
            height = width / aspectRatio
          } else {
            height = maxHeight
            width = height * aspectRatio
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageData
    })
  }

  async optimizeForEbay(imageData: string): Promise<string> {
    const resized = await this.resize(imageData, 1600, 1600)
    return this.editPhoto(resized, {
      brightness: 10,
      contrast: 5,
      saturation: 1.1,
    })
  }
}

export const photoEditorService = new PhotoEditorService()
