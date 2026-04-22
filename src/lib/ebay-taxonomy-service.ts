// Fetches eBay's official item-specifics schema for a category so the
// listing optimizer can produce aspects that match eBay's accepted values
// instead of AI-guessed keys. Backed by /api/ebay/taxonomy/:categoryId/aspects
// which calls the Commerce Taxonomy API with a client_credentials token.

export interface EbayAspectValue {
  localizedValue: string
}

export interface EbayAspectConstraint {
  aspectDataType?: string
  aspectMode?: 'FREE_TEXT' | 'SELECTION_ONLY'
  aspectRequired?: boolean
  aspectUsage?: 'RECOMMENDED' | 'OPTIONAL'
  itemToAspectCardinality?: 'SINGLE' | 'MULTI'
  aspectMaxLength?: number
}

export interface EbayAspect {
  localizedAspectName: string
  aspectConstraint: EbayAspectConstraint
  aspectValues?: EbayAspectValue[]
}

export interface EbayAspectsResponse {
  aspects?: EbayAspect[]
}

export interface SimplifiedAspect {
  name: string
  required: boolean
  recommended: boolean
  dataType: string
  mode: 'FREE_TEXT' | 'SELECTION_ONLY'
  cardinality: 'SINGLE' | 'MULTI'
  allowedValues: string[]
}

/**
 * Fetch and simplify item-specifics for a category. Returns `null` on any
 * failure so callers can fall back to AI-only generation.
 */
export async function fetchCategoryAspects(
  categoryId: string,
): Promise<SimplifiedAspect[] | null> {
  try {
    const resp = await fetch(
      `/api/ebay/taxonomy/${encodeURIComponent(categoryId)}/aspects`,
    )
    if (!resp.ok) {
      // 400 from get_item_aspects_for_category means the category is a parent,
      // not a leaf — eBay only publishes aspects at the leaf level. That's a
      // lookup-table authoring issue, not a runtime failure: the optimizer
      // falls back cleanly to AI-only specifics. Log at debug level for 400,
      // keep a real warn for anything else (401/403/5xx).
      const level = resp.status === 400 ? 'debug' : 'warn'
      // eslint-disable-next-line no-console
      console[level](`eBay taxonomy ${resp.status} for category ${categoryId} (likely non-leaf)`)
      return null
    }
    const data = (await resp.json()) as EbayAspectsResponse
    if (!Array.isArray(data.aspects)) return null
    return data.aspects.map(a => ({
      name: a.localizedAspectName,
      required: !!a.aspectConstraint?.aspectRequired,
      recommended: a.aspectConstraint?.aspectUsage === 'RECOMMENDED',
      dataType: a.aspectConstraint?.aspectDataType || 'STRING',
      mode: a.aspectConstraint?.aspectMode || 'FREE_TEXT',
      cardinality: a.aspectConstraint?.itemToAspectCardinality || 'SINGLE',
      allowedValues: (a.aspectValues || []).map(v => v.localizedValue).filter(Boolean),
    }))
  } catch (error) {
    console.warn('eBay taxonomy fetch failed:', error)
    return null
  }
}

/** Returns only the required + recommended aspects — the ones worth asking
 *  the LLM to fill in. Optional aspects bloat the prompt without improving
 *  listing quality meaningfully. */
export function pickImportantAspects(aspects: SimplifiedAspect[]): SimplifiedAspect[] {
  return aspects.filter(a => a.required || a.recommended)
}

/** Format aspects as a compact prompt block for the listing optimizer. */
export function aspectsToPromptBlock(aspects: SimplifiedAspect[]): string {
  if (aspects.length === 0) return ''
  const lines = aspects.map(a => {
    const tag = a.required ? '[REQUIRED]' : '[RECOMMENDED]'
    const values =
      a.mode === 'SELECTION_ONLY' && a.allowedValues.length > 0
        ? ` — must be one of: ${a.allowedValues.slice(0, 12).join(', ')}${a.allowedValues.length > 12 ? ', …' : ''}`
        : ''
    return `  ${tag} ${a.name}${values}`
  })
  return `eBay item specifics for this category (fill these exactly):\n${lines.join('\n')}`
}
