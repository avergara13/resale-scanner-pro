// Photo resolution utilities — single source of truth for which image a card should display.
//
// Invariant: after Photo Manager Done fires for an item, `photoUrls` (Supabase public URLs) is
// canonical. `imageData`/`additionalImageData` are in-memory scratch space (stripped on KV persist).
// `imageThumbnail` is a tiny compressed fallback that survives KV, used when no photoUrls exist
// (e.g. PASS items, manual-add items pre-Photo-Manager).

import type { ScannedItem } from '@/types'

/**
 * Returns the URL/data-URL to display in a card thumbnail for this item.
 * Priority:
 *   1. photoUrls[primaryPhotoIndex] (the user's curated primary product photo)
 *   2. photoUrls[0] (first uploaded product photo)
 *   3. imageThumbnail (tiny compressed scan frame, survives KV)
 *   4. imageData (raw base64 from capture — only present in-memory pre-persist)
 * Returns undefined if the item has no image at all (manual-add item before Photo Manager).
 * Callers MUST handle undefined by rendering a neutral placeholder icon — never a broken <img>.
 */
export function getCardPhoto(item: ScannedItem): string | undefined {
  if (item.photoUrls && item.photoUrls.length > 0) {
    const idx = item.primaryPhotoIndex ?? 0
    return item.photoUrls[idx] ?? item.photoUrls[0]
  }
  return item.imageThumbnail || item.imageData || undefined
}

/**
 * Returns all photos for this item, remote URLs preferred.
 * Used by detail views and ListingBuilder photo grids.
 */
export function getAllPhotos(item: ScannedItem): string[] {
  if (item.photoUrls && item.photoUrls.length > 0) return item.photoUrls
  const local = [item.imageData, ...(item.additionalImageData || [])].filter(Boolean) as string[]
  return local
}

/**
 * Fetches a remote photo URL and returns it as a data URL (base64-encoded).
 * Used by Re-analyze when an item has been KV-persisted: imageData is gone, photoUrls[0] is a
 * Supabase HTTPS URL, but the Gemini vision pipeline expects base64 via inline_data.
 * Throws on fetch failure — callers should catch and fall back to imageThumbnail.
 */
export async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Photo fetch failed: ${response.status} ${response.statusText}`)
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('FileReader returned non-string result'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}
