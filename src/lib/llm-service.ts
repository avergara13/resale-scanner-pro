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
 * Extract sell-through rate percentage from researchProduct() text output.
 * Returns 0 if no sell-through rate can be parsed.
 */
export function parseSellThroughRate(text: string): number {
  // Tier 1 — anchored structured line we force Gemini to emit
  const anchored = text.match(/SELL_THROUGH_RATE:\s*(\d+(?:\.\d+)?)%/)
  if (anchored) {
    const v = parseFloat(anchored[1])
    if (v >= 0 && v <= 100) return Math.round(v)
  }

  // Tier 2 — prose patterns
  const prosePatterns = [
    /sell[\s-]through\s+rate[:\s]+(\d+(?:\.\d+)?)%/i,
    /sell[\s-]through[:\s]+(\d+(?:\.\d+)?)%/i,
    /(\d+(?:\.\d+)?)%\s+sell[\s-]through/i,
    /sold\s+rate[:\s]+(\d+(?:\.\d+)?)%/i,
  ]
  for (const p of prosePatterns) {
    const m = text.match(p)
    if (m) {
      const v = parseFloat(m[1])
      if (v >= 0 && v <= 100) return Math.round(v)
    }
  }

  return 0
}

/**
 * Research a product using Gemini with Google Search grounding.
 * One deep, thorough web search covering ALL target stores — resale + retail + big box.
 * Returns structured real-time market intelligence including sell-through rate.
 */
export async function researchProduct(
  productName: string,
  context: { purchasePrice?: number; category?: string; brand?: string },
  geminiApiKey: string
): Promise<string> {
  const specialtyStores = getCategorySpecificStores(context.category || '', context.brand)
  const isFreeItem = context.purchasePrice === 0

  const prompt = `You are a professional resale market analyst. Perform a deep, comprehensive market research for: "${productName}"
${context.category ? `Category: ${context.category}` : ''}
${context.brand ? `Brand: ${context.brand}` : ''}
${context.purchasePrice != null ? (isFreeItem ? `This item was acquired FREE (purchase price: $0).` : `Purchase price paid: $${context.purchasePrice.toFixed(2)}`) : ''}

MANDATORY — search ALL of these sources RIGHT NOW before responding:

RESALE PLATFORMS (search SOLD/COMPLETED listings + count active listings for sell-through):
• eBay completed/sold listings — ebay.com (most important: count sold vs active to estimate sell-through)
• Mercari — mercari.com (sold listings)
• Poshmark — poshmark.com
• Whatnot — whatnot.com (auction results)
• Facebook Marketplace — facebook.com/marketplace (local comps)

RETAIL / BIG BOX (for MSRP anchor and discount context):
• Amazon — amazon.com
• Walmart — walmart.com
• Best Buy — bestbuy.com
• Target — target.com
• Ollie's Bargain Outlet — ollies.us
${specialtyStores.length > 0 ? `• Specialty: ${specialtyStores.join(', ')}` : ''}

PROVIDE ALL OF THE FOLLOWING:

1. **Resale value range** (from actual SOLD listings): Low: $X | Avg: $X | High: $X
2. **Retail / MSRP price** (new): $X — establishes the discount % buyers expect
3. **Sell-through rate**: Estimate what % of listed items SELL within 30 days on eBay.
   - Count or estimate: ~X sold/week, ~Y active listings → Z% sell-through rate
   - Rate tier: HIGH (>70%) / MEDIUM (40–70%) / LOW (<40%)
   - Sell velocity: "~X sold per week on eBay"
4. **Platform pricing breakdown** (with fees deducted from your take-home):
   - eBay: List $X → you keep ~$X after 12.9% fee + ~$5 shipping
   - Mercari: List $X → you keep ~$X after 10% fee
   - Poshmark: List $X → you keep ~$X after 20% fee (items >$15)
   - Whatnot: List $X → auction starting bid suggestion
   - Facebook Marketplace: List $X → you keep $X (0% fee, local pickup)
5. **Demand signal**: HIGH / MEDIUM / LOW — justify with search data
6. **Best platform recommendation**: [Platform] — because [reason: volume/margin/velocity]
${context.purchasePrice != null ? `7. **Verdict**: ${isFreeItem ? 'Which platform maximizes net profit for this FREE item (avoid platforms where fees exceed likely sale price)?' : `BUY or PASS at $${context.purchasePrice.toFixed(2)}? Show: sell price - fees - shipping - purchase price = net profit and margin`}` : ''}

Be specific with real dollar amounts from your search. Cite actual data found.

END your response with EXACTLY these three lines (no extra text on those lines):
RECOMMENDED_SELL_PRICE: $XX.XX
SELL_THROUGH_RATE: XX%
BEST_PLATFORM: [platform name]`

  return callGeminiGrounded(prompt, geminiApiKey, { maxTokens: 2048 })
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
