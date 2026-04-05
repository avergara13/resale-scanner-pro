export interface DetectedObject {
  name: string
  confidence: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  centerPoint: {
    x: number
    y: number
  }
  isMainProduct: boolean
}

export interface ObjectDetectionResult {
  objects: DetectedObject[]
  mainProduct?: DetectedObject
  suggestedCrop?: {
    x: number
    y: number
    width: number
    height: number
  }
  qualityScore: number
  recommendations: string[]
}

export class ObjectDetectionService {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey
    this.model = model
  }

  async detectObjects(imageData: string): Promise<ObjectDetectionResult> {
    const base64Data = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData

    const prompt = `Analyze this image and detect all visible objects. Identify the main product that should be the focus of a resale listing.

For each object detected, provide:
1. Object name/type
2. Confidence level (0-1)
3. Bounding box coordinates (normalized 0-1 relative to image dimensions)
4. Whether this is the main product to sell

Also provide:
- Suggested crop area to focus on the main product
- Image quality score (0-1) based on lighting, focus, framing
- Recommendations for improving the photo

Return as JSON:
{
  "objects": [
    {
      "name": "object name",
      "confidence": 0.0-1.0,
      "boundingBox": {
        "x": 0.0-1.0,
        "y": 0.0-1.0,
        "width": 0.0-1.0,
        "height": 0.0-1.0
      },
      "isMainProduct": true/false
    }
  ],
  "suggestedCrop": {
    "x": 0.0-1.0,
    "y": 0.0-1.0,
    "width": 0.0-1.0,
    "height": 0.0-1.0
  },
  "qualityScore": 0.0-1.0,
  "recommendations": ["list of suggestions for better photos"]
}

Focus on:
- Identifying the primary saleable product
- Detecting competing/distracting objects in frame
- Suggesting optimal framing for e-commerce listings
- Assessing photo quality (lighting, focus, angle)
- Providing actionable photography tips`

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    const url = `${endpoint}?key=${this.apiKey}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API')
      }

      const textContent = data.candidates[0].content.parts[0].text
      const result = JSON.parse(textContent)

      const objects: DetectedObject[] = (result.objects || []).map((obj: any) => ({
        name: obj.name,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox,
        centerPoint: {
          x: obj.boundingBox.x + obj.boundingBox.width / 2,
          y: obj.boundingBox.y + obj.boundingBox.height / 2,
        },
        isMainProduct: obj.isMainProduct || false,
      }))

      const mainProduct = objects.find(obj => obj.isMainProduct) || objects[0]

      return {
        objects,
        mainProduct,
        suggestedCrop: result.suggestedCrop,
        qualityScore: result.qualityScore || 0.5,
        recommendations: result.recommendations || [],
      }
    } catch (error) {
      console.error('Object detection failed:', error)
      throw error
    }
  }

  async detectObjectsFromVideo(
    videoElement: HTMLVideoElement
  ): Promise<ObjectDetectionResult> {
    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    ctx.drawImage(videoElement, 0, 0)
    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    
    return this.detectObjects(imageData)
  }

  calculateAbsoluteBox(
    normalizedBox: { x: number; y: number; width: number; height: number },
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: normalizedBox.x * imageWidth,
      y: normalizedBox.y * imageHeight,
      width: normalizedBox.width * imageWidth,
      height: normalizedBox.height * imageHeight,
    }
  }

  drawDetectionOverlay(
    canvas: HTMLCanvasElement,
    result: ObjectDetectionResult,
    options: {
      showAllObjects?: boolean
      showMainOnly?: boolean
      showCropSuggestion?: boolean
      highlightColor?: string
      cropColor?: string
    } = {}
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const {
      showAllObjects = true,
      showMainOnly = false,
      showCropSuggestion = true,
      highlightColor = '#00ff00',
      cropColor = '#ffaa00',
    } = options

    const width = canvas.width
    const height = canvas.height

    ctx.strokeStyle = highlightColor
    ctx.lineWidth = 3
    ctx.font = 'bold 16px IBM Plex Sans'
    ctx.fillStyle = highlightColor

    const objectsToDraw = showMainOnly && result.mainProduct 
      ? [result.mainProduct] 
      : result.objects

    if (showAllObjects || showMainOnly) {
      objectsToDraw.forEach((obj) => {
        const box = this.calculateAbsoluteBox(obj.boundingBox, width, height)

        ctx.strokeStyle = obj.isMainProduct ? '#00ff00' : '#ffffff'
        ctx.lineWidth = obj.isMainProduct ? 4 : 2

        ctx.strokeRect(box.x, box.y, box.width, box.height)

        const label = `${obj.name} (${Math.round(obj.confidence * 100)}%)`
        const textWidth = ctx.measureText(label).width
        
        ctx.fillStyle = obj.isMainProduct ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'
        ctx.fillRect(box.x, box.y - 25, textWidth + 10, 25)
        
        ctx.fillStyle = '#000000'
        ctx.fillText(label, box.x + 5, box.y - 7)
      })
    }

    if (showCropSuggestion && result.suggestedCrop) {
      const cropBox = this.calculateAbsoluteBox(result.suggestedCrop, width, height)
      
      ctx.strokeStyle = cropColor
      ctx.lineWidth = 3
      ctx.setLineDash([10, 5])
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height)
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(255, 170, 0, 0.8)'
      ctx.fillRect(cropBox.x, cropBox.y + cropBox.height + 5, 120, 25)
      ctx.fillStyle = '#000000'
      ctx.fillText('Suggested Crop', cropBox.x + 5, cropBox.y + cropBox.height + 22)
    }
  }
}

export function createObjectDetectionService(
  apiKey?: string,
  model?: string
): ObjectDetectionService | null {
  if (!apiKey || apiKey.length < 10) {
    return null
  }
  return new ObjectDetectionService(apiKey, model)
}
