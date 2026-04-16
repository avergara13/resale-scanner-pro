import type { ScannedItem } from '@/types'

/**
 * Remove the four in-memory-only base64 fields that must never be written to
 * KV-persisted state (queue, scanHistory). These blobs are multi-MB per photo
 * and overflow localStorage silently — past root cause of photos not sticking
 * to cards after first KV write.
 *
 * See JSDoc on ScannedItem photo fields in src/types/index.ts for the
 * persistence contract. Small thumbnails (imageThumbnail, additionalImages)
 * and remote URLs (photoUrls) are intentionally preserved.
 *
 * Canonical scrub used by every handler that constructs a persistable item.
 * DO NOT duplicate this pattern inline — call this function.
 */
export function stripPersistFields<T extends ScannedItem>(item: T): T {
  const {
    imageData: _imageData,
    imageOptimized: _imageOptimized,
    additionalImageData: _additionalImageData,
    photos: _photos,
    ...persistable
  } = item
  return persistable as T
}
