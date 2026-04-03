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
  sharpness?: number
  rotation?: number
  flipHorizontal?: boolean
  flipVertical?: boolean
  removeBackground?: boolean
  filter?: 'none' | 'vivid' | 'clean' | 'warm' | 'cool' | 'bw'
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

        const rotation = options.rotation || 0
        const needsRotation = rotation !== 0
        
        if (needsRotation) {
          const rad = (rotation * Math.PI) / 180
          const sin = Math.abs(Math.sin(rad))
          const cos = Math.abs(Math.cos(rad))
          
          canvas.width = img.width * cos + img.height * sin
          canvas.height = img.width * sin + img.height * cos
          
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate(rad)
          ctx.drawImage(img, -img.width / 2, -img.height / 2)
          ctx.setTransform(1, 0, 0, 1, 0, 0)
        } else if (options.crop) {
          canvas.width = options.crop.width
          canvas.height = options.crop.height
          
          if (options.flipHorizontal) {
            ctx.scale(-1, 1)
            ctx.translate(-canvas.width, 0)
          }
          if (options.flipVertical) {
            ctx.scale(1, -1)
            ctx.translate(0, -canvas.height)
          }
          
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
          
          if (options.flipHorizontal) {
            ctx.scale(-1, 1)
            ctx.translate(-canvas.width, 0)
          }
          if (options.flipVertical) {
            ctx.scale(1, -1)
            ctx.translate(0, -canvas.height)
          }
          
          ctx.drawImage(img, 0, 0)
        }

        if (options.brightness || options.contrast || options.saturation || options.sharpness || options.filter) {
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
    const saturation = options.saturation !== undefined ? options.saturation : 1
    const sharpness = options.sharpness || 0

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

      if (saturation !== 1) {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b
        r = this.clamp(gray + saturation * (r - gray))
        g = this.clamp(gray + saturation * (g - gray))
        b = this.clamp(gray + saturation * (b - gray))
      }

      if (options.filter) {
        const filtered = this.applyColorFilter(r, g, b, options.filter)
        r = filtered.r
        g = filtered.g
        b = filtered.b
      }

      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }

    ctx.putImageData(imageData, 0, 0)
    
    if (sharpness > 0) {
      this.applySharpen(ctx, width, height, sharpness)
    }
  }

  private applyColorFilter(r: number, g: number, b: number, filter: string): { r: number, g: number, b: number } {
    switch (filter) {
      case 'vivid':
        return {
          r: this.clamp(r * 1.2),
          g: this.clamp(g * 1.15),
          b: this.clamp(b * 1.1)
        }
      case 'clean':
        return {
          r: this.clamp(r * 1.05 + 5),
          g: this.clamp(g * 1.05 + 5),
          b: this.clamp(b * 1.1 + 10)
        }
      case 'warm':
        return {
          r: this.clamp(r * 1.1 + 10),
          g: this.clamp(g * 1.05),
          b: this.clamp(b * 0.95 - 5)
        }
      case 'cool':
        return {
          r: this.clamp(r * 0.95 - 5),
          g: this.clamp(g * 1.0),
          b: this.clamp(b * 1.1 + 10)
        }
      case 'bw':
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        return { r: gray, g: gray, b: gray }
      default:
        return { r, g, b }
    }
  }

  private applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const output = new Uint8ClampedArray(data)

    const weights = [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0]

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let val = 0
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const offset = ((y + ky) * width + (x + kx)) * 4 + c
              val += data[offset] * weights[(ky + 1) * 3 + (kx + 1)]
            }
          }
          output[(y * width + x) * 4 + c] = this.clamp(val)
        }
      }
    }

    for (let i = 0; i < data.length; i++) {
      data[i] = output[i]
    }

    ctx.putImageData(imageData, 0, 0)
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(255, value))
  }

  async removeBackground(
    imageData: string,
    geminiService: { removeBackground: (imageData: string, backgroundColor: 'white' | 'transparent') => Promise<string> } | null,
    backgroundColor: 'white' | 'transparent' = 'white'
  ): Promise<string> {
    if (!geminiService) {
      return this.simpleBackgroundRemoval(imageData, backgroundColor)
    }
    
    try {
      return await geminiService.removeBackground(imageData, backgroundColor)
    } catch (error) {
      console.error('Gemini background removal failed, falling back to simple removal:', error)
      return this.simpleBackgroundRemoval(imageData, backgroundColor)
    }
  }

  private async simpleBackgroundRemoval(
    imageData: string,
    backgroundColor: 'white' | 'transparent'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height

        if (backgroundColor === 'white') {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        ctx.drawImage(img, 0, 0)

        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageDataObj.data

        const centerX = img.width / 2
        const centerY = img.height / 2

        const cornerSamples = [
          this.getPixelColor(data, 0, 0, canvas.width),
          this.getPixelColor(data, canvas.width - 1, 0, canvas.width),
          this.getPixelColor(data, 0, canvas.height - 1, canvas.width),
          this.getPixelColor(data, canvas.width - 1, canvas.height - 1, canvas.width),
        ]

        const avgBgColor = {
          r: cornerSamples.reduce((sum, c) => sum + c.r, 0) / 4,
          g: cornerSamples.reduce((sum, c) => sum + c.g, 0) / 4,
          b: cornerSamples.reduce((sum, c) => sum + c.b, 0) / 4,
        }

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]

            const colorDiff = Math.sqrt(
              Math.pow(r - avgBgColor.r, 2) +
              Math.pow(g - avgBgColor.g, 2) +
              Math.pow(b - avgBgColor.b, 2)
            )

            const dx = x - centerX
            const dy = y - centerY
            const distanceFromCenter = Math.sqrt(dx * dx + dy * dy)
            const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)
            const centerProximity = 1 - (distanceFromCenter / maxDistance)

            const threshold = 40 - (centerProximity * 20)

            if (colorDiff < threshold) {
              if (backgroundColor === 'white') {
                data[idx] = 255
                data[idx + 1] = 255
                data[idx + 2] = 255
                data[idx + 3] = 255
              } else {
                data[idx + 3] = 0
              }
            }
          }
        }

        ctx.putImageData(imageDataObj, 0, 0)
        resolve(canvas.toDataURL(backgroundColor === 'transparent' ? 'image/png' : 'image/jpeg', 0.95))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageData
    })
  }

  private getPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number): { r: number, g: number, b: number } {
    const idx = (y * width + x) * 4
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
    }
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
      contrast: 8,
      saturation: 1.15,
      sharpness: 0.3,
      filter: 'clean'
    })
  }

  async autoEnhance(imageData: string): Promise<string> {
    return this.editPhoto(imageData, {
      brightness: 5,
      contrast: 10,
      saturation: 1.1,
      sharpness: 0.2
    })
  }

  async cropToSquare(imageData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const x = (img.width - size) / 2
        const y = (img.height - size) / 2

        this.editPhoto(imageData, {
          crop: { x, y, width: size, height: size }
        }).then(resolve).catch(reject)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageData
    })
  }

  async addWatermark(imageData: string, text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        ctx.font = `${Math.floor(img.width / 30)}px Arial`
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(text, img.width - 10, img.height - 10)

        resolve(canvas.toDataURL('image/jpeg', 0.95))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageData
    })
  }
}

export const photoEditorService = new PhotoEditorService()
