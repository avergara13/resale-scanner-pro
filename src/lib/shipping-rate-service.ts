import type { ShippingRateQuote } from '@/types'

interface ShippingRateInput {
  itemWeightLbs?: string | number | null
  packageDims?: string | null
  originZip?: string | null
  destinationZip?: string | null
  platform?: string | null
}

const USPS_PRIORITY_RATE_BY_WEIGHT = [
  { maxWeight: 1, nearby: 8.5, mid: 11.25, far: 14.75 },
  { maxWeight: 2, nearby: 9.75, mid: 13.5, far: 18.5 },
  { maxWeight: 5, nearby: 13.25, mid: 19.75, far: 28.5 },
  { maxWeight: 10, nearby: 18.75, mid: 25.5, far: 35.5 },
  { maxWeight: 20, nearby: 24.5, mid: 33.5, far: 44.5 },
  { maxWeight: 70, nearby: 31.5, mid: 44.5, far: 61.5 },
]

const USPS_GROUND_RATE_BY_WEIGHT = [
  { maxWeight: 0.5, nearby: 3.19, mid: 3.84, far: 4.49 },
  { maxWeight: 1, nearby: 4.49, mid: 4.99, far: 5.49 },
  { maxWeight: 2, nearby: 5.49, mid: 6.49, far: 7.49 },
  { maxWeight: 5, nearby: 7.49, mid: 9.74, far: 11.99 },
  { maxWeight: 10, nearby: 11.99, mid: 15.99, far: 19.99 },
  { maxWeight: 15, nearby: 19.99, mid: 23.49, far: 26.99 },
  { maxWeight: 70, nearby: 26.99, mid: 38.49, far: 49.99 },
]

const UPS_GROUND_RATE_BY_WEIGHT = [
  { maxWeight: 1, nearby: 10, mid: 12, far: 14 },
  { maxWeight: 2, nearby: 11, mid: 13, far: 15 },
  { maxWeight: 5, nearby: 12, mid: 15, far: 18 },
  { maxWeight: 10, nearby: 14, mid: 18, far: 22 },
  { maxWeight: 20, nearby: 18, mid: 23.5, far: 29 },
  { maxWeight: 50, nearby: 32, mid: 43.5, far: 55 },
]

const FLAT_RATE_OPTIONS = [
  { id: 'usps-flat-envelope', service: 'Priority Flat Rate Envelope', amount: 8.45, eta: '1-3 days', max: { length: 12.5, width: 9.5, height: 1 }, note: 'Best for soft goods, books, and flat media.' },
  { id: 'usps-flat-small', service: 'Priority Small Flat Rate Box', amount: 9.45, eta: '1-3 days', max: { length: 8.6875, width: 5.4375, height: 1.75 }, note: 'Best when a compact heavy item fits.' },
  { id: 'usps-flat-medium', service: 'Priority Medium Flat Rate Box', amount: 15.5, eta: '1-3 days', max: { length: 11, width: 8.5, height: 5.5 }, note: 'Good for medium, dense items.' },
  { id: 'usps-flat-large', service: 'Priority Large Flat Rate Box', amount: 21.9, eta: '1-3 days', max: { length: 12, width: 12, height: 5.5 }, note: 'Useful when standard Priority rates jump.' },
]

function parseWeightLbs(value?: string | number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value) return 1
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseDims(value?: string | null): { length: number; width: number; height: number } | null {
  if (!value) return null
  const parts = value
    .split(/x|×/i)
    .map((part) => Number.parseFloat(part.replace(/[^0-9.]/g, '')))
    .filter((part) => Number.isFinite(part) && part > 0)

  if (parts.length < 3) return null

  const [length, width, height] = parts.sort((a, b) => b - a)
  return { length, width, height }
}

function getZoneBucket(originZip?: string | null, destinationZip?: string | null): 'nearby' | 'mid' | 'far' {
  const origin = Number.parseInt((originZip || '').slice(0, 1), 10)
  const destination = Number.parseInt((destinationZip || '').slice(0, 1), 10)

  if (!Number.isFinite(origin) || !Number.isFinite(destination)) return 'mid'

  const distance = Math.abs(origin - destination)
  if (distance <= 1) return 'nearby'
  if (distance <= 3) return 'mid'
  return 'far'
}

function lookupRate(
  weightLbs: number,
  table: Array<{ maxWeight: number; nearby: number; mid: number; far: number }>,
  zone: 'nearby' | 'mid' | 'far',
): number {
  const row = table.find((candidate) => weightLbs <= candidate.maxWeight) || table[table.length - 1]
  return row[zone]
}

function fitsFlatRate(dims: { length: number; width: number; height: number } | null, max: { length: number; width: number; height: number }): boolean {
  if (!dims) return true
  return dims.length <= max.length && dims.width <= max.width && dims.height <= max.height
}

function applyPlatformDiscount(amount: number, platform?: string | null): number {
  if (!platform || platform.toLowerCase() !== 'ebay') return amount
  return Math.max(0, amount - 0.5)
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function estimateShippingRates(input: ShippingRateInput): ShippingRateQuote[] {
  const weightLbs = parseWeightLbs(input.itemWeightLbs)
  const dims = parseDims(input.packageDims)
  const zone = getZoneBucket(input.originZip, input.destinationZip)

  const quotes: ShippingRateQuote[] = [
    {
      id: 'usps-ground-advantage',
      carrier: 'USPS',
      service: 'Ground Advantage',
      amount: roundCurrency(applyPlatformDiscount(lookupRate(weightLbs, USPS_GROUND_RATE_BY_WEIGHT, zone), input.platform)),
      currency: 'USD',
      eta: '2-5 days',
      note: weightLbs <= 3 ? 'Usually the cheapest for lightweight packages.' : 'Good baseline for most packages.',
      source: 'guide-estimate',
    },
    {
      id: 'usps-priority-mail',
      carrier: 'USPS',
      service: 'Priority Mail',
      amount: roundCurrency(applyPlatformDiscount(lookupRate(weightLbs, USPS_PRIORITY_RATE_BY_WEIGHT, zone), input.platform)),
      currency: 'USD',
      eta: '1-3 days',
      note: 'Faster option when Ground Advantage is close in price.',
      source: 'guide-estimate',
    },
    {
      id: 'ups-ground',
      carrier: 'UPS',
      service: 'Ground',
      amount: roundCurrency(applyPlatformDiscount(lookupRate(weightLbs, UPS_GROUND_RATE_BY_WEIGHT, zone), input.platform)),
      currency: 'USD',
      eta: '1-5 days',
      note: weightLbs > 5 ? 'Often better for heavier or bulkier packages.' : 'Usually loses on lightweight packages.',
      source: 'guide-estimate',
    },
  ]

  for (const option of FLAT_RATE_OPTIONS) {
    if (!fitsFlatRate(dims, option.max)) continue
    quotes.push({
      id: option.id,
      carrier: 'USPS',
      service: option.service,
      amount: roundCurrency(applyPlatformDiscount(option.amount, input.platform)),
      currency: 'USD',
      eta: option.eta,
      note: option.note,
      source: 'guide-estimate',
    })
  }

  const topQuotes = quotes.sort((left, right) => left.amount - right.amount).slice(0, 3)
  if (topQuotes[0]) {
    topQuotes[0] = { ...topQuotes[0], isBestValue: true }
  }
  return topQuotes
}

export function createPirateShipUrl(input: ShippingRateInput & { title?: string | null }): string {
  const params = new URLSearchParams({
    reference: input.title || 'Resale Scanner shipment',
    from: input.originZip || '32806',
    to: input.destinationZip || '',
    weight: String(Math.max(1, Math.round(parseWeightLbs(input.itemWeightLbs) * 16))),
  })
  return `https://ship.pirateship.com/ship/single?${params.toString()}`
}
