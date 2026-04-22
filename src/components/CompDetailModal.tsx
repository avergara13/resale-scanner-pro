import { useEffect, useState } from 'react'
import { ArrowSquareOut, Truck, User, MapPin, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { fetchItemDetail, type EbayItemDetail } from '@/lib/ebay-finances-service'
import { logDebug } from '@/lib/debug-log'

// Drill-down modal for a single Market-card comp tap. Renders immediately
// with whatever fields are already in the comp (title, price, thumbnail,
// condition, sold date) so the modal never flashes blank. If the comp
// carries an itemId we kick off GET /api/ebay/item/:itemId in parallel and
// progressively reveal seller / shipping / returns when it lands — a 4xx/5xx
// or a missing itemId is silent; the basics + "View on eBay" CTA stay put.

export interface Comp {
  title: string
  price: number
  condition?: string
  soldDate?: string
  itemId?: string
  itemWebUrl?: string
  thumbnail?: string
}

interface CompDetailModalProps {
  comp: Comp | null
  onClose: () => void
}

function formatPrice(price?: number): string {
  if (price == null || Number.isNaN(price)) return '—'
  return `$${price.toFixed(2)}`
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function CompDetailModal({ comp, onClose }: CompDetailModalProps) {
  const [detail, setDetail] = useState<EbayItemDetail | null>(null)
  const [enrichState, setEnrichState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  useEffect(() => {
    if (!comp) {
      setDetail(null)
      setEnrichState('idle')
      return
    }
    if (!comp.itemId) {
      setEnrichState('idle')
      return
    }

    let cancelled = false
    setEnrichState('loading')
    setDetail(null)

    fetchItemDetail(comp.itemId)
      .then(res => {
        if (cancelled) return
        if (res.status === 'ok') {
          setDetail(res.data)
          setEnrichState('ok')
          logDebug('comp detail fetched', 'debug', 'ebay', { itemId: comp.itemId })
        } else {
          setEnrichState('error')
          logDebug('comp detail fetch failed', 'warn', 'ebay', {
            itemId: comp.itemId,
            status: res.status,
          })
        }
      })
      .catch(err => {
        if (cancelled) return
        setEnrichState('error')
        logDebug('comp detail fetch threw', 'error', 'ebay', {
          itemId: comp.itemId,
          message: (err as Error).message,
        })
      })

    return () => {
      cancelled = true
    }
  }, [comp])

  const open = comp !== null
  const thumb = detail?.image?.imageUrl || comp?.thumbnail
  const seller = detail?.seller
  const shipping = detail?.shippingOptions?.[0]
  const location = detail?.itemLocation
  const returns = detail?.returnTerms

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-s1 shadow-2xl">
        {comp && (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base text-t1 line-clamp-3 text-left">
                {comp.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {thumb && (
                <div className="aspect-square w-full max-h-64 overflow-hidden rounded-lg border border-s2 bg-bg flex items-center justify-center">
                  <img
                    src={thumb}
                    alt={comp.title}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-mono text-sm font-bold">
                  {formatPrice(comp.price)}
                </Badge>
                {comp.condition && (
                  <Badge variant="outline" className="text-xs">
                    {comp.condition}
                  </Badge>
                )}
                {comp.soldDate && (
                  <span className="text-xs text-t3">Sold {formatDate(comp.soldDate)}</span>
                )}
              </div>

              {enrichState === 'ok' && (seller || shipping || location || returns) && (
                <>
                  <Separator />
                  <div className="space-y-2 text-xs text-t2">
                    {seller?.username && (
                      <div className="flex items-center gap-2">
                        <User size={14} weight="bold" className="text-t3 flex-shrink-0" />
                        <span className="truncate">
                          {seller.username}
                          {seller.feedbackPercentage &&
                            ` · ${seller.feedbackPercentage}%${seller.feedbackScore ? ` (${seller.feedbackScore})` : ''}`}
                        </span>
                      </div>
                    )}
                    {location?.country && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} weight="bold" className="text-t3 flex-shrink-0" />
                        <span className="truncate">
                          {[location.city, location.stateOrProvince, location.country]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                    {shipping && (
                      <div className="flex items-center gap-2">
                        <Truck size={14} weight="bold" className="text-t3 flex-shrink-0" />
                        <span className="truncate">
                          {shipping.shippingCost?.value
                            ? parseFloat(shipping.shippingCost.value) === 0
                              ? 'Free shipping'
                              : `$${parseFloat(shipping.shippingCost.value).toFixed(2)} shipping`
                            : 'Shipping'}
                          {shipping.minEstimatedDeliveryDate &&
                            ` · by ${formatDate(shipping.minEstimatedDeliveryDate)}`}
                        </span>
                      </div>
                    )}
                    {returns && (
                      <div className="flex items-center gap-2">
                        <ArrowCounterClockwise size={14} weight="bold" className="text-t3 flex-shrink-0" />
                        <span className="truncate">
                          {returns.returnsAccepted
                            ? `Returns accepted${returns.returnPeriod?.value ? ` (${returns.returnPeriod.value} ${returns.returnPeriod.unit?.toLowerCase() || 'days'})` : ''}`
                            : 'No returns'}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {comp.itemWebUrl && (
                <a
                  href={comp.itemWebUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-b1 bg-b1/10 px-4 py-2.5 text-sm font-semibold text-b1 hover:bg-b1/20 transition-colors"
                >
                  View on eBay
                  <ArrowSquareOut size={14} weight="bold" />
                </a>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
