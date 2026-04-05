/**
 * Unified LLM call with fallback chain:
 * 1. Try window.spark.llm() (GitHub Spark platform)
 * 2. Fall back to direct Gemini API if spark unavailable
 * 3. Return descriptive error if both fail
 */

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

async function callGeminiDirect(
  prompt: string,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp',
  jsonMode: boolean = false
): Promise<string> {
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Gemini API ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned empty or blocked response')
  }
  return text
}

export async function callLLM(
  prompt: string,
  options: {
    model?: string
    geminiApiKey?: string
    jsonMode?: boolean
    timeout?: number
  } = {}
): Promise<string> {
  const { model = 'gemini-2.0-flash-exp', geminiApiKey, jsonMode = false, timeout = 30000 } = options

  // Try window.spark.llm first (GitHub Spark platform)
  if (typeof window !== 'undefined' && window.spark?.llm) {
    try {
      const response = await Promise.race([
        window.spark.llm(prompt, model, jsonMode),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Spark LLM timed out')), timeout)
        ),
      ])
      if (response && response.trim().length > 0) {
        return response
      }
      // Empty response — fall through to Gemini
    } catch (sparkError) {
      console.warn('Spark LLM failed, falling back to Gemini:', sparkError)
    }
  }

  // Fallback to direct Gemini API
  if (geminiApiKey && geminiApiKey.length >= 10) {
    return callGeminiDirect(prompt, geminiApiKey, model, jsonMode)
  }

  throw new Error('AI unavailable — configure Gemini API key in Settings')
}
