import { useState, useRef, useCallback } from 'react'
import { ArrowLeft, Star, X, Image, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single slot in the photo grid.
 *  - type 'existing': already-uploaded Supabase URL — pass through unchanged, no re-upload
 *  - type 'local': new base64/data-URL captured this session — will be uploaded on Done
 */
type PhotoSlot =
  | { type: 'existing'; url: string }
  | { type: 'local'; data: string }

export interface PhotoManagerProps {
  /** Already-uploaded Supabase Storage URLs (https://). Displayed first. */
  initialExistingUrls: string[]
  /** New base64/data-URL photos added before entering this screen (e.g. from scan). */
  initialLocalPhotos: string[]
  initialPrimaryIndex?: number
  itemName?: string
  sku?: string
  /** 'buy' → "Save Photos & Add to Listings"
   *  'maybe' → "Save Photos & Keep in Pile"
   *  'edit' → "Save Photos" */
  mode: 'buy' | 'maybe' | 'edit'
  /** App.tsx handles upload + queue add + navigation.
   *  Photo Manager shows a spinner while this promise is pending.
   *  Pass existing URLs back unchanged; new local photos need uploading.
   *  Called with (orderedSlots, primaryIndex) where orderedSlots preserves type info. */
  onDone: (existingUrls: string[], localPhotos: string[], primaryIndex: number) => Promise<void>
  onBack: () => void
}

const MAX_PHOTOS = 24

// ── Component ─────────────────────────────────────────────────────────────────

export function PhotoManager({
  initialExistingUrls,
  initialLocalPhotos,
  initialPrimaryIndex = 0,
  itemName,
  sku,
  mode,
  onDone,
  onBack,
}: PhotoManagerProps) {
  // Merge into unified ordered list — existing first, then new local captures
  const [slots, setSlots] = useState<PhotoSlot[]>(() => [
    ...initialExistingUrls.map((url): PhotoSlot => ({ type: 'existing', url })),
    ...initialLocalPhotos.map((data): PhotoSlot => ({ type: 'local', data })),
  ])
  const [primaryIndex, setPrimaryIndex] = useState(initialPrimaryIndex)
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retakeInputRef = useRef<HTMLInputElement>(null)

  // Drag-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getSrc = (slot: PhotoSlot) =>
    slot.type === 'existing' ? slot.url : slot.data

  // ── Photo actions ─────────────────────────────────────────────────────────────

  const handleSetPrimary = useCallback((idx: number) => {
    setPrimaryIndex(idx)
  }, [])

  const handleDeleteConfirm = useCallback((idx: number) => {
    setConfirmDeleteIndex(idx)
  }, [])

  const handleDeleteExecute = useCallback(() => {
    if (confirmDeleteIndex === null) return
    setSlots(prev => {
      const next = prev.filter((_, i) => i !== confirmDeleteIndex)
      // Adjust primaryIndex if needed
      setPrimaryIndex(p => {
        if (p === confirmDeleteIndex) return 0
        if (p > confirmDeleteIndex) return p - 1
        return p
      })
      return next
    })
    setConfirmDeleteIndex(null)
  }, [confirmDeleteIndex])

  // ── Add from library ──────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const available = MAX_PHOTOS - slots.length
    const toAdd = files.slice(0, available)
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const data = ev.target?.result as string
        if (data) {
          setSlots(prev => {
            if (prev.length >= MAX_PHOTOS) return prev
            return [...prev, { type: 'local', data }]
          })
        }
      }
      reader.readAsDataURL(file)
    })
    // Reset input so the same file can be re-added after a delete
    e.target.value = ''
  }, [slots.length])

  // ── Retake scan photo (replaces index 0) ─────────────────────────────────────

  const handleRetakeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const data = ev.target?.result as string
      if (data) {
        setSlots(prev => {
          const next = [...prev]
          next[0] = { type: 'local', data }
          return next
        })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  // ── Drag reorder ──────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((idx: number) => setDragIndex(idx), [])
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIndex(idx)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    setSlots(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIdx, 0, moved)
      // Keep primary pointing to the same slot after reorder
      setPrimaryIndex(p => {
        if (p === dragIndex) return dropIdx
        if (dragIndex < dropIdx) {
          if (p > dragIndex && p <= dropIdx) return p - 1
        } else {
          if (p >= dropIdx && p < dragIndex) return p + 1
        }
        return p
      })
      return next
    })
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  // ── Done ──────────────────────────────────────────────────────────────────────

  const handleDone = useCallback(async () => {
    setIsUploading(true)
    setUploadError(null)
    const existingUrls = slots.filter(s => s.type === 'existing').map(s => (s as { type: 'existing'; url: string }).url)
    const localPhotos = slots.filter(s => s.type === 'local').map(s => (s as { type: 'local'; data: string }).data)
    // Count total uploads for progress (only local photos need uploading)
    setUploadProgress({ done: 0, total: localPhotos.length })
    try {
      await onDone(existingUrls, localPhotos, primaryIndex)
    } catch {
      setUploadError('Upload failed — listing saved without photos. You can retry from the listing card.')
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }, [slots, primaryIndex, onDone])

  // ── Done button label ─────────────────────────────────────────────────────────

  const doneLabel =
    mode === 'buy' ? 'Save Photos & Add to Listings' :
    mode === 'maybe' ? 'Save Photos & Keep in Pile' :
    'Save Photos'

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-label="Choose photos from library"
      />
      <input
        ref={retakeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleRetakeChange}
        aria-label="Retake scan photo"
      />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-s2/40">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-s1 active:scale-95 transition-all text-t2"
          aria-label="Go back"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black tracking-tight text-t1 leading-tight">Listing Photos</h1>
          {(itemName || sku) && (
            <p className="text-[11px] text-t3 truncate mt-0.5">
              {[itemName, sku].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className={cn(
          'text-[11px] font-bold px-2 py-0.5 rounded-full',
          slots.length >= MAX_PHOTOS ? 'bg-red/10 text-red' : 'bg-s1 text-t3'
        )}>
          {slots.length} / {MAX_PHOTOS}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Photo grid */}
        <div className="px-4 pt-4 pb-2">
          {slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border-2 border-dashed border-s2/60">
              <Image size={36} weight="thin" className="text-t3" />
              <p className="text-sm text-t3">No photos yet</p>
              <p className="text-xs text-t3/70">Add photos using the buttons below</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing',
                    dragOverIndex === idx && dragIndex !== idx
                      ? 'border-b1 scale-105'
                      : primaryIndex === idx
                        ? 'border-amber'
                        : 'border-s2/40',
                    dragIndex === idx && 'opacity-50'
                  )}
                >
                  {/* Thumbnail */}
                  <img
                    src={getSrc(slot)}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />

                  {/* Primary star badge */}
                  <button
                    onClick={() => handleSetPrimary(idx)}
                    className={cn(
                      'absolute top-1 left-1 w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90',
                      primaryIndex === idx
                        ? 'bg-amber text-white shadow-sm'
                        : 'bg-black/40 text-white/70 hover:bg-black/60'
                    )}
                    aria-label={primaryIndex === idx ? 'Primary photo' : 'Set as primary photo'}
                  >
                    {primaryIndex === idx
                      ? <Star size={13} weight="fill" />
                      : <Star size={13} weight="regular" />
                    }
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteConfirm(idx)}
                    className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-white/70 hover:bg-red hover:text-white transition-all active:scale-90"
                    aria-label="Remove photo"
                  >
                    <X size={13} weight="bold" />
                  </button>

                  {/* Primary label under first photo */}
                  {primaryIndex === idx && (
                    <div className="absolute bottom-0 left-0 right-0 bg-amber/80 text-white text-[9px] font-bold text-center py-0.5 uppercase tracking-wide">
                      Primary
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 space-y-2">
          {/* Choose from library */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={slots.length >= MAX_PHOTOS}
            className={cn(
              'w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-bold transition-all active:scale-98',
              slots.length >= MAX_PHOTOS
                ? 'border-s2/40 text-t3/50 cursor-not-allowed'
                : 'border-b1/40 text-b1 hover:bg-b1/5 hover:border-b1'
            )}
          >
            <Image size={18} weight="regular" />
            Choose from Library
          </button>

          {/* Use Listing Camera — disabled this sprint, camera round-trip state needs separate wiring */}
          <button
            disabled
            title="Coming soon — use Choose from Library"
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-s2/40 text-s2 text-sm font-bold cursor-not-allowed select-none"
          >
            <Image size={18} weight="regular" />
            Use Listing Camera
            <span className="text-[10px] font-normal text-t3/60 ml-1">(coming soon)</span>
          </button>

          {/* Retake scan photo — only shown when there are existing photos */}
          {slots.length > 0 && (
            <button
              onClick={() => retakeInputRef.current?.click()}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-t3 hover:text-t2 hover:bg-s1 text-xs font-medium transition-all active:scale-98"
            >
              <ArrowsClockwise size={14} weight="regular" />
              Retake Scan Photo (replaces photo 1)
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirmDeleteIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-sm bg-bg rounded-t-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-black text-t1">Remove this photo?</h3>
            <p className="text-sm text-t2">This photo will be removed from the listing.</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setConfirmDeleteIndex(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-red text-white hover:bg-red/90"
                onClick={handleDeleteExecute}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload error banner */}
      {uploadError && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-red/10 border border-red/20 text-sm text-red">
          {uploadError}
        </div>
      )}

      {/* Done button */}
      <div className="px-4 pb-6 pt-2 border-t border-s2/40">
        <Button
          onClick={handleDone}
          disabled={isUploading}
          className="w-full h-14 bg-b1 text-white hover:bg-b1/90 text-sm font-bold rounded-xl transition-all active:scale-98 disabled:opacity-70"
        >
          {isUploading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {uploadProgress && uploadProgress.total > 0
                ? `Uploading ${uploadProgress.done} / ${uploadProgress.total} photos...`
                : 'Saving...'
              }
            </span>
          ) : (
            doneLabel
          )}
        </Button>
      </div>
    </div>
  )
}
