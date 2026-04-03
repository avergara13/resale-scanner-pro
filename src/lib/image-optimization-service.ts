export interface ImageOptimizationOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
}

export interface ThumbnailOptions {
  width: number
  height: number
  quality?: number
  format?: 'jpeg' | 'webp'
}

export interface OptimizedImage {
  original: string
  thumbnail: string
  width: number
  height: number
  size: number
  thumbnailSize: number
}

const DEFAULT_THUMBNAIL_SIZE = 200
const DEFAULT_PREVIEW_SIZE = 800
const DEFAULT_QUALITY = 0.8
const THUMBNAIL_QUALITY = 0.6

export function createImageOptimizationService() {
  const compressImage = async (
    imageData: string,
    options: ImageOptimizationOptions = {}
  ): Promise<string> => {
    const {
      maxWidth = DEFAULT_PREVIEW_SIZE,
      maxHeight = DEFAULT_PREVIEW_SIZE,
      quality = DEFAULT_QUALITY,
      format = 'jpeg'
    } = options

    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        try {
          let { width, height } = img
          
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height
            
            if (width > height) {
              width = maxWidth
              height = Math.round(width / aspectRatio)
            } else {
              height = maxHeight
              width = Math.round(height * aspectRatio)
            }
          }
          
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }
          
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)
          
          const mimeType = format === 'webp' ? 'image/webp' : 
                          format === 'png' ? 'image/png' : 'image/jpeg'
          
          const compressedData = canvas.toDataURL(mimeType, quality)
          resolve(compressedData)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = imageData
    })
  }

  const generateThumbnail = async (
    imageData: string,
    options: ThumbnailOptions = { width: DEFAULT_THUMBNAIL_SIZE, height: DEFAULT_THUMBNAIL_SIZE }
  ): Promise<string> => {
    const {
      width = DEFAULT_THUMBNAIL_SIZE,
      height = DEFAULT_THUMBNAIL_SIZE,
      quality = THUMBNAIL_QUALITY,
      format = 'jpeg'
    } = options

    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const aspectRatio = img.width / img.height
          
          let thumbWidth = width
          let thumbHeight = height
          
          if (aspectRatio > 1) {
            thumbHeight = Math.round(width / aspectRatio)
          } else {
            thumbWidth = Math.round(height * aspectRatio)
          }
          
          canvas.width = thumbWidth
          canvas.height = thumbHeight
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }
          
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'medium'
          ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight)
          
          const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg'
          const thumbnailData = canvas.toDataURL(mimeType, quality)
          resolve(thumbnailData)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image for thumbnail'))
      }
      
      img.src = imageData
    })
  }

  const optimizeImage = async (
    imageData: string,
    generateThumb: boolean = true
  ): Promise<OptimizedImage> => {
    const [compressed, thumbnail] = await Promise.all([
      compressImage(imageData, {
        maxWidth: DEFAULT_PREVIEW_SIZE,
        maxHeight: DEFAULT_PREVIEW_SIZE,
        quality: DEFAULT_QUALITY,
        format: 'jpeg'
      }),
      generateThumb ? generateThumbnail(imageData, {
        width: DEFAULT_THUMBNAIL_SIZE,
        height: DEFAULT_THUMBNAIL_SIZE,
        quality: THUMBNAIL_QUALITY,
        format: 'jpeg'
      }) : Promise.resolve('')
    ])

    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = compressed
    })

    const originalSize = Math.round((imageData.length * 3) / 4)
    const compressedSize = Math.round((compressed.length * 3) / 4)
    const thumbnailSize = thumbnail ? Math.round((thumbnail.length * 3) / 4) : 0

    return {
      original: compressed,
      thumbnail: thumbnail || compressed,
      width: img.width,
      height: img.height,
      size: compressedSize,
      thumbnailSize: thumbnailSize || compressedSize
    }
  }

  const getImageDimensions = (imageData: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = imageData
    })
  }

  const estimateImageSize = (imageData: string): number => {
    return Math.round((imageData.length * 3) / 4)
  }

  const batchOptimize = async (
    images: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<OptimizedImage[]> => {
    const results: OptimizedImage[] = []
    
    for (let i = 0; i < images.length; i++) {
      try {
        const optimized = await optimizeImage(images[i])
        results.push(optimized)
        
        if (onProgress) {
          onProgress(i + 1, images.length)
        }
      } catch (error) {
        console.error(`Failed to optimize image ${i}:`, error)
        results.push({
          original: images[i],
          thumbnail: images[i],
          width: 0,
          height: 0,
          size: estimateImageSize(images[i]),
          thumbnailSize: estimateImageSize(images[i])
        })
      }
    }
    
    return results
  }

  return {
    compressImage,
    generateThumbnail,
    optimizeImage,
    getImageDimensions,
    estimateImageSize,
    batchOptimize
  }
}

export type ImageOptimizationService = ReturnType<typeof createImageOptimizationService>
