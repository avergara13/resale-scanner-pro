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

import { retryFetch } from './retry-service'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'

// ------- Gemini (primary) -------

async function callGemini(
  prompt: string,
  apiKey: string,
  options: { model?: string; jsonMode?: boolean; maxTokens?: number; temperature?: number; systemInstruction?: string } = {}
): Promise<string> {
  const { model = 'gemini-2.5-flash', jsonMode = false, maxTokens = 2048, temperature = 0.7, systemInstruction } = options
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }
  // Gemini caches systemInstruction across requests with identical prefixes,
  // reducing per-request token billing for the static instruction portion
  if (systemInstruction && systemInstruction.trim().length > 10) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  // Inspect block/safety reasons before extracting text
  const candidate = data?.candidates?.[0]
  const blockReason = candidate?.blockReason || data?.promptFeedback?.blockReason
  if (blockReason) {
    throw new Error(`Gemini blocked: ${blockReason}. Try rephrasing your message.`)
  }
  if (candidate?.finishReason === 'SAFETY') {
    throw new Error('Response blocked by safety filter. Try rephrasing.')
  }
  const text = candidate?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned empty response — the model may not have received proper context')
  }
  return text
}

// ------- Category-aware store list for market research -------

function getCategorySpecificStores(category: string, brand?: string): string[] {
  const cat = (category || '').toLowerCase()
  const stores: string[] = []

  if (cat.includes('shoe') || cat.includes('sneaker') || cat.includes('boot') || cat.includes('footwear')) {
    stores.push('footlocker.com', 'nike.com', 'adidas.com', 'stockx.com', 'goat.com', 'flightclub.com', 'zappos.com')
  }
  if (cat.includes('electronic') || cat.includes('tech') || cat.includes('computer') || cat.includes('phone') || cat.includes('console') || cat.includes('gaming')) {
    stores.push('newegg.com', 'bhphotovideo.com', 'adorama.com', 'gamestop.com', 'backmarket.com', 'swappa.com')
  }
  if (cat.includes('cloth') || cat.includes('apparel') || cat.includes('fashion') || cat.includes('shirt') || cat.includes('pants') || cat.includes('jacket') || cat.includes('dress')) {
    stores.push('depop.com', 'grailed.com', 'thredup.com', 'tradesy.com')
  }
  if (cat.includes('toy') || cat.includes('collectible') || cat.includes('lego') || cat.includes('figure') || cat.includes('card') || cat.includes('game')) {
    stores.push('toysrus.com', 'comc.com', 'pricecharting.com', 'funko.com', 'tcgplayer.com')
  }
  if (cat.includes('sport') || cat.includes('outdoor') || cat.includes('fitness') || cat.includes('golf')) {
    stores.push('dickssportinggoods.com', 'rei.com', 'academy.com')
  }
  if (cat.includes('furniture') || cat.includes('home') || cat.includes('decor') || cat.includes('kitchen')) {
    stores.push('wayfair.com', 'ikea.com', 'homedepot.com', 'craigslist.org')
  }

  if (brand) {
    const b = brand.toLowerCase()
    if (b.includes('nike')) stores.push('nike.com')
    if (b.includes('adidas')) stores.push('adidas.com')
    if (b.includes('apple')) stores.push('apple.com', 'swappa.com')
    if (b.includes('lego')) stores.push('lego.com')
    if (b.includes('sony')) stores.push('sony.com')
    if (b.includes('samsung')) stores.push('samsung.com')
    if (b.includes('jordan') || b.includes('air jordan')) stores.push('stockx.com', 'goat.com')
  }

  return [...new Set(stores)]
}

// ------- Gemini with Google Search grounding (for product research) -------

async function callGeminiGrounded(
  prompt: string,
  apiKey: string,
  options: { model?: string; maxTokens?: number } = {}
): Promise<string> {
  const { model = 'gemini-2.5-flash', maxTokens = 2048 } = options
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`

  type GeminiResponse = { candidates?: Array<{ content: { parts: Array<{ text?: string }> } }> }
  const data = await retryFetch<GeminiResponse>(
    url,
    {
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
    },
    { maxRetries: 3, initialDelay: 1500, maxDelay: 10000, timeout: 45000 }
  )

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini search returned empty response')
  return text
}

/**
 * Extract the recommended sell price from researchProduct() text output.
 * Tries explicit "recommended price" patterns first, then eBay-specific,
 * then averages, then price ranges (takes midpoint).
 * Returns 0 if no price can be parsed.
 */
export function parseResearchPrice(text: string): number {
  // Tier 1 — anchored structured line we force Gemini to emit
  const anchored = text.match(/RECOMMENDED_SELL_PRICE:\s*\$?([\d,]+(?:\.\d{1,2})?)/)
  if (anchored) {
    const p = parseFloat(anchored[1].replace(/,/g, ''))
    if (p > 0 && p < 50000) return Math.round(p * 100) / 100
  }

  // Tier 2 — specific semantic patterns in the prose
  const patterns: Array<[RegExp, 'single' | 'range']> = [
    [/recommended\s+(?:list\s+)?price[:\s]+\$?([\d,]+(?:\.\d{1,2})?)/i, 'single'],
    [/(?:list|sell)\s+(?:at|for)[:\s]+\$?([\d,]+(?:\.\d{1,2})?)/i, 'single'],
    [/resale\s+value[:\s]+\$?([\d,]+(?:\.\d{1,2})?)/i, 'single'],
    [/average\s+(?:sold\s+)?(?:price\s*)?[:\s]+\$?([\d,]+(?:\.\d{1,2})?)/i, 'single'],
    [/avg(?:erage)?\s*[:\-–]\s*\$?([\d,]+(?:\.\d{1,2})?)/i, 'single'],
    [/\$(\d[\d,]*(?:\.\d{1,2})?)\s*[-–—to]+\s*\$(\d[\d,]*(?:\.\d{1,2})?)/i, 'range'],
  ]
  for (const [pattern, type] of patterns) {
    const m = text.match(pattern)
    if (!m) continue
    if (type === 'range' && m[2]) {
      const lo = parseFloat(m[1].replace(/,/g, ''))
      const hi = parseFloat(m[2].replace(/,/g, ''))
      const mid = (lo + hi) / 2
      if (mid > 0 && mid < 50000) return Math.round(mid * 100) / 100
    } else {
      const p = parseFloat(m[1].replace(/,/g, ''))
      if (p > 0 && p < 50000) return p
    }
  }

  // Tier 3 — broad sweep: collect ALL dollar amounts, return median of plausible resale values
  const dollarRe = /\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g
  const amounts: number[] = []
  let m: RegExpExecArray | null
  while ((m = dollarRe.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''))
    if (v >= 2 && v <= 2000) amounts.push(v)  // filter out retail-tag noise & extremely high values
  }
  if (amounts.length > 0) {
    amounts.sort((a, b) => a - b)
    const mid = Math.floor(amounts.length / 2)
    const median = amounts.length % 2 === 0
      ? (amounts[mid - 1] + amounts[mid]) / 2
      : amounts[mid]
    return Math.round(median * 100) / 100
  }

  return 0
}

/**
 * Research a product using Gemini with Google Search grounding.
 * Queries all 5 resale platforms + core retail stores + category-specific specialty stores.
 * Returns structured real-time market intelligence.
 */
export async function researchProduct(
  productName: string,
  context: { purchasePrice?: number; category?: string; brand?: string },
  geminiApiKey: string
): Promise<string> {
  const resalePlatforms = ['ebay.com', 'mercari.com', 'poshmark.com', 'whatnot.com', 'facebook.com/marketplace']
  const retailStores = ['amazon.com', 'walmart.com', 'bestbuy.com', 'target.com']
  const specialtyStores = getCategorySpecificStores(context.category || '', context.brand)

  const prompt = `You are a professional resale market analyst for a resale business. Research current pricing for: "${productName}"
${context.category ? `Category: ${context.category}` : ''}
${context.brand ? `Brand: ${context.brand}` : ''}
${context.purchasePrice ? `Purchase price paid: $${context.purchasePrice.toFixed(2)}` : ''}

Search ALL of the following sources:

RESALE PLATFORMS — check SOLD/COMPLETED listings (most important):
${resalePlatforms.join(' | ')}

RETAIL STORES — check new/MSRP pricing (for resale discount context):
${retailStores.join(' | ')}
${specialtyStores.length > 0 ? `\nSPECIALTY STORES for this category:\n${specialtyStores.join(' | ')}` : ''}

Provide a concise analysis with:
1. **Resale value range**: low / average / high from actual sold listings
2. **Retail price** (new): what stores charge for it new (establishes discount %)
3. **Best resale platform** with reasoning (volume + price)
4. **Platform pricing guide**:
   - eBay: $X (12.9% fee)
   - Mercari: $X (10% fee)
   - Poshmark: $X (20% fee >$15)
   - Whatnot: $X (auction — starting bid)
   - Facebook Marketplace: $X (local, no fees)
5. **Demand**: high / medium / low — sell-through velocity
6. **Recommended list price** for best margin + speed
${context.purchasePrice ? `7. **Verdict**: BUY or PASS at $${context.purchasePrice.toFixed(2)} — with margin estimate` : ''}

Be specific with dollar amounts. Cite actual marketplace data found.

REQUIRED — always end your response with this exact line (replace XX.XX with the average resale price you found):
RECOMMENDED_SELL_PRICE: $XX.XX`

  return callGeminiGrounded(prompt, geminiApiKey, { maxTokens: 1500 })
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
      ...(systemPrompt && systemPrompt.trim().length > 10 ? { system: systemPrompt } : {}),
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
      systemInstruction: systemPrompt,
    })
  }

  const tried: string[] = []
  if (task === 'complex' && anthropicApiKey) tried.push('Claude (failed)')
  if (!geminiApiKey || geminiApiKey.length < 10) tried.push('Gemini (no API key)')
  throw new Error(`AI unavailable${tried.length ? ` — ${tried.join(', ')}` : ''} — configure API keys in Settings`)
}
