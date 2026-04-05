/**
 * Unified LLM service — cost-optimized dual-model architecture
 *
 * Primary:   Google Gemini 2.0 Flash — chat, search, listing generation (cheap, fast)
 * Secondary: Anthropic Claude — complex reasoning, math, agentic orchestration (used sparingly)
 *
 * Cost strategy:
 *   - Gemini Flash for 90%+ of calls (free tier / low cost)
 *   - Claude only for tasks tagged 'complex' (profit analysis, multi-step reasoning)
 *   - Never use Claude for simple chat or listing text generation
 */

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'

// ------- Gemini (primary) -------

async function callGemini(
  prompt: string,
  apiKey: string,
  options: { model?: string; jsonMode?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { model = 'gemini-2.5-flash', jsonMode = false, maxTokens = 2048, temperature = 0.7 } = options
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned empty or blocked response')
  }
  return text
}

// ------- Gemini with Google Search grounding (for product research) -------

async function callGeminiGrounded(
  prompt: string,
  apiKey: string,
  options: { model?: string; maxTokens?: number } = {}
): Promise<string> {
  const { model = 'gemini-2.5-flash', maxTokens = 2048 } = options
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini Search ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini search returned empty response')
  return text
}

/**
 * Research a product using Gemini with Google Search grounding.
 * Returns real-time market data from the web.
 */
export async function researchProduct(
  productName: string,
  context: { purchasePrice?: number; category?: string },
  geminiApiKey: string
): Promise<string> {
  const prompt = `Research the current resale market value for: "${productName}"
${context.category ? `Category: ${context.category}` : ''}
${context.purchasePrice ? `Purchase price: $${context.purchasePrice.toFixed(2)}` : ''}

Search eBay sold listings, Amazon, Mercari, Poshmark, and other resale marketplaces.

Provide:
1. **Estimated resale value range** (low / average / high) based on actual sold listings
2. **Best marketplace** to sell this item (eBay, Mercari, Poshmark, etc.)
3. **Demand level** (high/medium/low) based on how many are selling
4. **Profit assessment** — is this a good buy at the purchase price?
5. **Recommended listing price** for fastest sale with good margin

Be specific with dollar amounts. Reference actual marketplace data.`

  return callGeminiGrounded(prompt, geminiApiKey, { maxTokens: 1024 })
}

// ------- Anthropic Claude (secondary — complex tasks only) -------

async function callClaude(
  prompt: string,
  apiKey: string,
  options: { model?: string; maxTokens?: number; systemPrompt?: string } = {}
): Promise<string> {
  const { model = 'claude-haiku-4-5-20251001', maxTokens = 1024, systemPrompt } = options

  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Claude ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text
  if (!text) {
    throw new Error('Claude returned empty response')
  }
  return text
}

// ------- Public API -------

export type LLMTask = 'chat' | 'listing' | 'research' | 'complex'

export interface LLMOptions {
  task?: LLMTask
  geminiApiKey?: string
  anthropicApiKey?: string
  model?: string
  jsonMode?: boolean
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Route LLM calls by task type for cost optimization:
 *   chat     → Gemini Flash (cheapest)
 *   listing  → Gemini Flash (fast generation)
 *   research → Gemini Flash (bulk queries)
 *   complex  → Claude Haiku first, falls back to Gemini
 */
export async function callLLM(prompt: string, options: LLMOptions = {}): Promise<string> {
  const {
    task = 'chat',
    geminiApiKey,
    anthropicApiKey,
    model,
    jsonMode = false,
    maxTokens,
    temperature,
    systemPrompt,
  } = options

  // Complex tasks → try Claude first (better reasoning, still cost-efficient with Haiku)
  if (task === 'complex' && anthropicApiKey && anthropicApiKey.length >= 10) {
    try {
      return await callClaude(prompt, anthropicApiKey, {
        model: model || 'claude-haiku-4-5-20251001',
        maxTokens: maxTokens || 1024,
        systemPrompt,
      })
    } catch (claudeError) {
      console.warn('Claude failed, falling back to Gemini:', claudeError)
      // Fall through to Gemini
    }
  }

  // All other tasks (and Claude fallback) → Gemini Flash
  if (geminiApiKey && geminiApiKey.length >= 10) {
    return callGemini(prompt, geminiApiKey, {
      model: model || 'gemini-2.5-flash',
      jsonMode,
      maxTokens: maxTokens || (task === 'listing' ? 2048 : 1024),
      temperature: temperature ?? (task === 'chat' ? 0.7 : 0.4),
    })
  }

  throw new Error('AI unavailable — configure Gemini API key in Settings')
}
