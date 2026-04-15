import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Base64 → Blob helper ──────────────────────────────────────────────────────
function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  // Strip data URI prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

// ── EnrichedScanRecord — mirrors Supabase public.scans columns ────────────────
export interface EnrichedScanRecord {
  // Core identification (Supabase-generated if omitted)
  id?: string
  notion_page_id?: string
  ebay_listing_id?: string
  title?: string
  raw_analysis?: Record<string, unknown>

  // eBay listing fields
  ebay_category_id?: string
  item_specifics?: Record<string, string>
  seo_title?: string
  subtitle?: string
  upc_ean?: string
  brand?: string
  model?: string

  // Condition
  condition?: string
  condition_description?: string
  item_description?: string

  // Attributes
  color?: string
  size?: string
  department?: string
  seo_keywords?: string[]

  // Dimensions / weight
  item_weight_oz?: number
  item_dimensions_lwh?: string

  // Shipping & fulfillment
  shipping_strategy?: string
  handling_time_days?: number
  free_shipping?: boolean
  return_policy?: Record<string, unknown>
  ebay_listing_type?: string
  listing_duration?: string

  // Pricing & offers
  listing_price?: number
  best_offer_enabled?: boolean
  auto_accept_price?: number
  auto_decline_price?: number

  // Comp data
  comp_range_low?: number
  comp_range_high?: number
  sold_comp_count?: number

  // Financial estimates
  ebay_fvf_rate?: number
  est_shipping_label_cost?: number
  gross_profit_est?: number
  roi_pct_est?: number
  break_even_price?: number
  net_payout_est?: number

  // Photos
  photo_count?: number
  photo_filenames?: string[]
  photo_urls?: string[]

  // Metadata
  subtitle_cost_flag?: boolean
  pending_schema_additions?: Record<string, unknown>
  notion_push_status?: string
  notion_push_timestamp?: string
  session_id?: string
  operator_id?: string
  purchase_price?: number
  decision?: string
}

export class SupabaseService {
  private client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey)
  }

  /** Upsert enriched scan record. Returns the row id on success, null on failure. */
  async saveScan(data: EnrichedScanRecord): Promise<{ id: string } | null> {
    try {
      const { data: rows, error } = await this.client
        .from('scans')
        .upsert(data, { onConflict: 'id' })
        .select('id')
        .single()

      if (error) {
        console.warn('[supabase] saveScan error:', error.message)
        return null
      }
      return rows as { id: string }
    } catch (e) {
      console.warn('[supabase] saveScan failed:', e)
      return null
    }
  }

  /** Upload a base64 image to listing-photos/[sku]/[filename].
   *  Returns public URL on success, null on failure (logged, never throws). */
  async uploadPhoto(base64: string, sku: string, filename: string): Promise<string | null> {
    try {
      const blob = base64ToBlob(base64)
      const path = `${sku}/${filename}`
      const { error } = await this.client.storage
        .from('listing-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

      if (error) {
        console.warn('[supabase] uploadPhoto error:', error.message)
        return null
      }

      const { data } = this.client.storage.from('listing-photos').getPublicUrl(path)
      return data.publicUrl
    } catch (e) {
      console.warn('[supabase] uploadPhoto failed:', e)
      return null
    }
  }

  /** Returns public URL for a stored file path. */
  getPublicUrl(path: string): string {
    const { data } = this.client.storage.from('listing-photos').getPublicUrl(path)
    return data.publicUrl
  }
}
