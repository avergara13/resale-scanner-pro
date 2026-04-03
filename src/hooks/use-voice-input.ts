import { useState, useCallback } from 'react'
import { voiceService } from '@/lib/voice-service'
import { toast } from 'sonner'

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false)

  const startListening = useCallback((onTranscript: (text: string) => void) => {
    if (!voiceService.isSupported()) {
      toast.error('Voice input not supported in this browser')
      return
    }

    setIsListening(true)
    voiceService.start(
      (transcript) => {
        setIsListening(false)
        onTranscript(transcript)
      },
      (error) => {
        setIsListening(false)
        toast.error(`Voice input error: ${error}`)
      }
    )
  }, [])

  const stopListening = useCallback(() => {
    voiceService.stop()
    setIsListening(false)
  }, [])

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: voiceService.isSupported(),
  }
}
