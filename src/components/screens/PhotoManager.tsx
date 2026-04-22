import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, Star, X, Image, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
  /** Called when user taps "Use Listing Camera". App opens the camera overlay and calls
   *  onCapturedPhotoConsumed after passing the result back via capturedPhoto. */
  onAddViaCamera?: (currentPrimaryIndex: number) => void
  /** Image data-URL captured from the listing camera. Photo Manager appends it to slots
   *  then calls onCapturedPhotoConsumed to clear the prop. */
  capturedPhoto?: string
  onCapturedPhotoConsumed?: () => void
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
  onAddViaCamera,
  capturedPhoto,
  onCapturedPhotoConsumed,
}: PhotoManagerProps) {
  // Merge into unified ordered list — existing first, then new local captures
  const [slots, setSlots] = useState<PhotoSlot[]>(() => [
    ...initialExistingUrls.map((url): PhotoSlot => ({ type: 'existing', url })),
    ...initialLocalPhotos.map((data): PhotoSlot => ({ type: 'local', data })),
  ])
  const [primaryIndex, setPrimaryIndex] = useState(initialPrimaryIndex)
  // WS-21 Phase 2: re-scan of an existing listing — explicit keep-vs-replace choice.
  // Default OFF (start fresh). User opts in to preserve the old Supabase photos.
  // Only meaningful when editing a listing that actually has existing URLs.
  const hasExistingUrls = initialExistingUrls.length > 0
  const showKeepExistingToggle = mode === 'edit' && hasExistingUrls
  const [keepExisting, setKeepExisting] = useState(false)
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retakeInputRef = useRef<HTMLInputElement>(null)

  // Drag-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Consume capturedPhoto from listing camera overlay — append to slots then clear.
  // The ref guard is critical: if App re-renders for an unrelated reason while
  // capturedPhoto is still set, the effect would otherwise re-fire and append a
  // duplicate. Tracking the consumed value by identity makes this idempotent.
  const consumedPhotoRef = useRef<string | null>(null)
  useEffect(() => {
    if (!capturedPhoto || consumedPhotoRef.current === capturedPhoto) return
    consumedPhotoRef.current = capturedPhoto
    let droppedAtMax = false
    setSlots(prev => {
      if (prev.length >= MAX_PHOTOS) {
        droppedAtMax = true
        return prev
      }
      return [...prev, { type: 'local', data: capturedPhoto }]
    })
    if (droppedAtMax) {
      toast.error(`Maximum ${MAX_PHOTOS} photos reached — capture discarded`)
    }
    onCapturedPhotoConsumed?.()
  }, [capturedPhoto, onCapturedPhotoConsumed])

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
    // WS-21 Phase 2: when the keep-existing toggle is OFF (edit mode default),
    // drop existing URLs so the save overwrites the listing's photos with only
    // the new local captures. Downstream delete-cascade handles the old photos.
    const existingUrls = showKeepExistingToggle && !keepExisting
      ? []
      : slots.filter(s => s.type === 'existing').map(s => (s as { type: 'existing'; url: string }).url)
    const localPhotos = slots.filter(s => s.type === 'local').map(s => (s as { type: 'local'; data: string }).data)
    // primaryIndex is measured against the full slot list. When we drop the
    // existing slots (keep-existing toggle OFF), the remaining localPhotos
    // array indexes over a reordered subset — so we remap by counting how
    // many existing slots sat *before* the primary, not total. Handles the
    // case where drag-reorder interleaves existing and local slots like
    // [local, existing, local, existing] with primary somewhere in the middle.
    const dropExisting = showKeepExistingToggle && !keepExisting
    const existingBeforePrimary = dropExisting
      ? slots.slice(0, primaryIndex).filter(s => s.type === 'existing').length
      : 0
    const primarySlot = slots[primaryIndex]
    // If the primary slot itself was an existing URL being dropped, fall back to
    // the first remaining local (index 0) — the user saw a dimmed slot and
    // accepted the replacement.
    const remappedPrimaryIndex = dropExisting && primarySlot?.type === 'existing'
      ? 0
      : Math.max(0, primaryIndex - existingBeforePrimary)
    // Count total uploads for progress (only local photos need uploading)
    setUploadProgress({ done: 0, total: localPhotos.length })
    try {
      await onDone(existingUrls, localPhotos, remappedPrimaryIndex)
    } catch {
      setUploadError('Upload failed — listing saved without photos. You can retry from the listing card.')
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }, [slots, primaryIndex, onDone, showKeepExistingToggle, keepExisting])

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
      <div className="material-chrome sticky top-0 z-10 flex items-center gap-3 border-b border-separator px-4 py-3">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-s1 active:scale-95 transition-all text-t2"
          aria-label="Go back"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-title-3 font-semibold tracking-tight text-t1 leading-tight">Listing Photos</h1>
          {(itemName || sku) && (
            <p className="mt-0.5 truncate text-footnote text-t3">
              {[itemName, sku].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className={cn(
          'rounded-full px-2.5 py-1 text-caption-1 font-semibold',
          slots.length >= MAX_PHOTOS ? 'border border-system-red/15 bg-system-red/10 text-chip-label-red' : 'border border-separator/70 bg-system-fill text-secondary-label'
        )}>
          {slots.length} / {MAX_PHOTOS}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* WS-21 Phase 2: keep-existing-photos toggle for re-scan (edit mode).
            Default OFF so re-scans start fresh; user opts in to preserve. */}
        {showKeepExistingToggle && (
          <div className="mx-4 mt-3 p-3 rounded-xl border border-s2/40 bg-fg flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-t1">
                Keep {initialExistingUrls.length} existing photo{initialExistingUrls.length !== 1 ? 's' : ''}?
              </p>
              <p className="text-xs text-t3 mt-0.5">
                {keepExisting
                  ? 'Existing photos will be preserved and new ones added.'
                  : 'Existing photos will be replaced by this scan.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={keepExisting}
              onClick={() => setKeepExisting(v => !v)}
              className={cn(
                'relative w-11 h-6 rounded-full flex-shrink-0 transition-colors',
                keepExisting ? 'bg-b1' : 'bg-s2/60'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                  keepExisting ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        )}

        {/* Photo grid */}
        <div className="px-4 pt-4 pb-2">
          {slots.length === 0 ? (
            <EmptyState
              icon={<Image weight="thin" />}
              title="No photos yet"
              description="Add photos using the buttons below"
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot, idx) => {
                const willBeDropped = showKeepExistingToggle && !keepExisting && slot.type === 'existing'
                return (
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
                    dragIndex === idx && 'opacity-50',
                    willBeDropped && 'opacity-40 grayscale'
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
                    <div className="absolute bottom-0 left-0 right-0 bg-system-orange/90 py-1 text-center text-caption-1 font-bold uppercase tracking-[0.14em] text-white">
                      Primary
                    </div>
                  )}
                </div>
                )
              })}
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

          <button
            onClick={() => onAddViaCamera?.(primaryIndex)}
            disabled={slots.length >= MAX_PHOTOS || !onAddViaCamera}
            className={cn(
              'w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-bold transition-all active:scale-98',
              slots.length >= MAX_PHOTOS || !onAddViaCamera
                ? 'border-s2/40 text-t3/50 cursor-not-allowed'
                : 'border-b1/40 text-b1 hover:bg-b1/5 hover:border-b1'
            )}
          >
            <Image size={18} weight="regular" />
            Use Listing Camera
          </button>

          {/* Retake scan photo — only shown when there are existing photos */}
          {slots.length > 0 && (
            <button
              onClick={() => retakeInputRef.current?.click()}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-t3 hover:text-t2 hover:bg-s1 text-footnote font-medium transition-all active:scale-98"
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
