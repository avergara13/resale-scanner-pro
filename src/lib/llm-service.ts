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

// Hard upper bound on any single LLM HTTP call — prevents the UI from hanging
// forever if the provider hangs the socket without responding.
const LLM_FETCH_TIMEOUT_MS = 45_000

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = LLM_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  // Chain onto any caller-supplied signal so external aborts still propagate
  const callerSignal = init.signal
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason)
    else callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true })
  }
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError')),
    timeoutMs,
  )
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// ------- In-memory research cache -------
// Prevents duplicate API calls when the same product is scanned multiple times
// in a session (common at thrift stores). TTLs mirror retry-config.ts definitions.

interface CacheEntry { result: string; expiresAt: number }
const researchCache = new Map<string, CacheEntry>()

const CACHE_TTL_MS = {
  research: 10 * 60 * 1000,  // 10 min — balance between API cost and price freshness
  vision:   5  * 60 * 1000,  // 5 min  — same image, same result
} as const

function cacheKey(...parts: (string | undefined)[]): string {
  // Sentinel-separated so "nike|air max" and "nike air|max" don't collide.
  // `\x1f` (ASCII unit separator) never appears in product names.
  return parts.map(p => (p ?? '').toLowerCase().trim()).join('\x1f')
}

function cacheGet(key: string): string | null {
  const entry = researchCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { researchCache.delete(key); return null }
  return entry.result
}

function cacheSet(key: string, result: string, ttl: number): void {
  // Keep cache bounded — evict oldest entries when over 100 items
  if (researchCache.size >= 100) {
    const oldest = [...researchCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]
    if (oldest) researchCache.delete(oldest[0])
  }
  researchCache.set(key, { result, expiresAt: Date.now() + ttl })
}

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
      // Gemini 2.5 Flash defaults to "thinking" mode — the model burns output
      // tokens on internal reasoning before emitting the response. For JSON
      // tasks (listing optimizer, structured extraction) this truncates the
      // JSON mid-string and trips "Unterminated string" in JSON.parse, forcing
      // a fallback listing. Disabling thinking reclaims the full maxTokens
      // budget for the actual response. Chat / creative tasks keep thinking.
      ...(jsonMode
        ? { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  }
  // Gemini caches systemInstruction across requests with identical prefixes,
  // reducing per-request token billing for the static instruction portion
  if (systemInstruction && systemInstruction.trim().length > 10) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`Gemini request timed out after ${LLM_FETCH_TIMEOUT_MS / 1000}s — network or provider issue`)
    }
    throw err
  }

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
    if (v >= 2 && v <= 50000) amounts.push(v)  // filter out noise but keep high-value resale items
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
  // Cache hit — same product + category within the last 30 min, skip the API call
  const key = cacheKey(productName, context.category, context.brand)
  const cached = cacheGet(key)
  if (cached) {
    console.info(`[llm-cache] HIT — ${productName} (${context.category ?? 'general'})`)
    return cached
  }

  const specialtyStores = getCategorySpecificStores(context.category || '', context.brand)
  const isFreeItem = context.purchasePrice === 0

  const prompt = `You are a professional resale market analyst. Perform a deep, comprehensive market research for: "${productName}"
${context.category ? `Category: ${context.category}` : ''}
${context.brand ? `Brand: ${context.brand}` : ''}
${context.purchasePrice != null ? (isFreeItem ? `This item was acquired FREE (purchase price: $0).` : `Purchase price paid: $${context.purchasePrice.toFixed(2)}`) : ''}

Seller ships from Orlando, FL 32806. eBay is the primary platform.

## CRITICAL ANTI-HALLUCINATION RULES
- ONLY report prices you actually found in search results. If you cannot find sold data, say "No sold data found" — do NOT invent prices.
- If fewer than 3 sold comps exist, flag the data as LOW CONFIDENCE and widen the price range.
- NEVER exaggerate sell-through rates. If you are unsure, default to MEDIUM (40-70%) and explain why.
- Distinguish clearly between ASKING prices (what sellers list) and SOLD prices (what actually sold). Base your recommendation on SOLD prices only.
- Do NOT use retail/MSRP as a basis for resale pricing — use actual completed sale data from resale platforms.

## MANDATORY SOURCES — search ALL of these before responding:

RESALE PLATFORMS (search SOLD/COMPLETED listings + count active listings):
• eBay completed/sold listings — ebay.com (MOST IMPORTANT: how many sold recently, what prices, how many active right now)
• Mercari — mercari.com (sold listings)
• Poshmark — poshmark.com (sold listings)
• Whatnot — whatnot.com (auction results)

RETAIL PRICE CHECK (for market value context only — NOT for setting resale price):
• Amazon — amazon.com
• Walmart — walmart.com
• Google Shopping — shopping.google.com (general market overview)
${specialtyStores.length > 0 ? `• Specialty: ${specialtyStores.join(', ')}` : ''}

## PROVIDE ALL OF THE FOLLOWING:

1. **Resale value range** (from actual SOLD listings ONLY — not asking prices):
   Low: $X | Avg: $X | High: $X
   Data confidence: HIGH (10+ sold comps) / MEDIUM (3-9 comps) / LOW (<3 comps)

2. **Retail / MSRP price** (new): $X — for context only, NOT for pricing

3. **Sell-through analysis** (eBay focus):
   - Active listings right now: ~Y listings
   - Recently sold (last 30-90 days): ~X sold
   - Sell-through rate: Z% (sold / (sold + active))
   - Rate tier: HIGH (>70%) / MEDIUM (40–70%) / LOW (<40%)
   - Sell velocity: "~X sold per week on eBay"
   - If data is uncertain, state "estimated" and explain your reasoning

4. **Platform pricing breakdown** (net take-home after ALL fees):
   - eBay: List $X → net ~$X after 12.9% FVF + 3% ad fee + $0.30/order + ~$5 shipping + $0.75 materials
   - Mercari: List $X → net ~$X after 10% fee
   - Poshmark: List $X → net ~$X after 20% fee (items >$15)
   - Whatnot: Auction starting bid suggestion: $X

5. **Demand signal**: HIGH / MEDIUM / LOW — justify with specific search data

6. **Best platform recommendation**: [Platform] — because [reason]

${context.purchasePrice != null ? `7. **BUY/PASS Verdict**: ${isFreeItem ? 'Which platform maximizes net profit for this FREE item?' : `At $${context.purchasePrice.toFixed(2)} purchase price, show the math:
   Sell price - eBay fee (12.9%) - ad fee (3%) - $0.30 order fee - shipping (~$5) - materials ($0.75) - purchase price = net profit
   Margin = net profit / sell price × 100
   Verdict: BUY (if margin ≥ 30%) or PASS (if margin < 30%)`}` : ''}

## PRICING STRATEGY
Recommend a "middle-high" listing price: above the average sold price but below the highest sold price. This maximizes margin while maintaining reasonable sell-through. The seller can always reduce later.

END your response with EXACTLY these three lines (no extra text on those lines):
RECOMMENDED_SELL_PRICE: $XX.XX
SELL_THROUGH_RATE: XX%
BEST_PLATFORM: [platform name]`

  const result = await callGeminiGrounded(prompt, geminiApiKey, { maxTokens: 2048 })
  cacheSet(key, result, CACHE_TTL_MS.research)
  console.info(`[llm-cache] STORE — ${productName} (expires in 10 min)`)
  return result
}

// ------- OpenAI (1st fallback) -------

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

async function callOpenAI(
  prompt: string,
  apiKey: string,
  options: { model?: string; maxTokens?: number; temperature?: number; systemPrompt?: string } = {}
): Promise<string> {
  const { model = 'gpt-4o-mini', maxTokens = 1024, temperature = 0.7, systemPrompt } = options

  type Message = { role: 'system' | 'user'; content: string }
  const messages: Message[] = []
  if (systemPrompt && systemPrompt.trim().length > 10) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  let response: Response
  try {
    response = await fetchWithTimeout(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // SECURITY: BYO-key — user supplies their own key stored only in local device settings.
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`OpenAI request timed out after ${LLM_FETCH_TIMEOUT_MS / 1000}s — network or provider issue`)
    }
    throw err
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('OpenAI returned empty response')
  }
  return text
}

// ------- Anthropic Claude (2nd / last fallback) -------

async function callClaude(
  prompt: string,
  apiKey: string,
  options: { model?: string; maxTokens?: number; systemPrompt?: string } = {}
): Promise<string> {
  const { model = 'claude-haiku-4-5-20251001', maxTokens = 1024, systemPrompt } = options

  let response: Response
  try {
    response = await fetchWithTimeout(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // SECURITY: This header enables direct browser→Anthropic calls which exposes
        // the API key to the client. Acceptable here because the key is a user-supplied
        // BYO-key stored only in local device settings (not a server secret).
        // Never ship this with a shared/tenant key.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(systemPrompt && systemPrompt.trim().length > 10 ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`Claude request timed out after ${LLM_FETCH_TIMEOUT_MS / 1000}s — network or provider issue`)
    }
    throw err
  }

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
  openaiApiKey?: string
  anthropicApiKey?: string
  model?: string
  jsonMode?: boolean
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Linear provider cascade — always tries in this order, regardless of task type:
 *   1. Gemini Flash  (primary — cheapest, fastest, Google Search grounding)
 *   2. OpenAI        (1st fallback — gpt-4o-mini)
 *   3. Anthropic     (2nd / last fallback — Claude Haiku)
 *
 * If a provider key is absent or the call fails, the next provider is tried.
 * All three failures are reported in the thrown error message.
 */
export async function callLLM(prompt: string, options: LLMOptions = {}): Promise<string> {
  const {
    task = 'chat',
    geminiApiKey,
    openaiApiKey,
    anthropicApiKey,
    model,
    jsonMode = false,
    maxTokens,
    temperature,
    systemPrompt,
  } = options

  const errors: string[] = []

  // ── 1. Gemini (primary) ──────────────────────────────────────────────────
  if (geminiApiKey && geminiApiKey.length >= 10) {
    try {
      return await callGemini(prompt, geminiApiKey, {
        model: model || 'gemini-2.5-flash',
        jsonMode,
        maxTokens: maxTokens || (task === 'listing' ? 2048 : 1024),
        temperature: temperature ?? (task === 'chat' ? 0.7 : 0.4),
        systemInstruction: systemPrompt,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.debug('[LLM] Gemini failed, trying next provider:', msg)
      errors.push(`Gemini: ${msg}`)
    }
  }

  // ── 2. OpenAI (1st fallback) ─────────────────────────────────────────────
  if (openaiApiKey && openaiApiKey.length >= 10) {
    try {
      return await callOpenAI(prompt, openaiApiKey, {
        model: model || 'gpt-4o-mini',
        maxTokens: maxTokens || 1024,
        temperature: temperature ?? (task === 'chat' ? 0.7 : 0.4),
        systemPrompt,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.debug('[LLM] OpenAI failed, trying next provider:', msg)
      errors.push(`OpenAI: ${msg}`)
    }
  }

  // ── 3. Anthropic Claude (2nd / last fallback) ────────────────────────────
  if (anthropicApiKey && anthropicApiKey.length >= 10) {
    try {
      return await callClaude(prompt, anthropicApiKey, {
        model: model || 'claude-haiku-4-5-20251001',
        maxTokens: maxTokens || 1024,
        systemPrompt,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.debug('[LLM] Claude failed:', msg)
      errors.push(`Claude: ${msg}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`All AI providers failed — ${errors.join(' | ')}`)
  }
  throw new Error('AI unavailable — configure a Gemini, OpenAI, or Anthropic API key in Settings')
}
