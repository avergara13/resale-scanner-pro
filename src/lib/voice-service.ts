export class VoiceService {
  private recognition: any
  private isListening: boolean = false
  private onResultCallback?: (transcript: string) => void
  private onErrorCallback?: (error: string) => void

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition()
    } else if ('SpeechRecognition' in window) {
      this.recognition = new (window as any).SpeechRecognition()
    }

    if (this.recognition) {
      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.lang = 'en-US'

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (this.onResultCallback) {
          this.onResultCallback(transcript)
        }
        this.isListening = false
      }

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error)
        }
        this.isListening = false
      }

      this.recognition.onend = () => {
        this.isListening = false
      }
    }
  }

  isSupported(): boolean {
    return !!this.recognition
  }

  start(onResult: (transcript: string) => void, onError?: (error: string) => void) {
    if (!this.recognition) {
      if (onError) {
        onError('Speech recognition not supported')
      }
      return
    }

    if (this.isListening) {
      this.stop()
    }

    this.onResultCallback = onResult
    this.onErrorCallback = onError
    this.isListening = true

    try {
      this.recognition.start()
    } catch (error) {
      console.error('Failed to start recognition:', error)
      this.isListening = false
      if (onError) {
        onError('Failed to start recognition')
      }
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  getIsListening(): boolean {
    return this.isListening
  }
}

export const voiceService = new VoiceService()
