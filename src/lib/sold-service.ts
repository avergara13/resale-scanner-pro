import type { SoldFeedResponse, SoldItem, SoldShippingUpdateInput } from '@/types'
import { retryFetch } from './retry-service'

const SOLD_API_BASE = '/api/sold-items'

export async function fetchSoldItems(): Promise<SoldFeedResponse> {
  return retryFetch<SoldFeedResponse>(SOLD_API_BASE, undefined, {
    maxRetries: 2,
    initialDelay: 500,
    timeout: 15000,
  })
}

export async function updateSoldItemShipping(pageId: string, update: SoldShippingUpdateInput): Promise<SoldItem> {
  const response = await retryFetch<{ item: SoldItem }>(`${SOLD_API_BASE}/${pageId}/shipping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update),
  }, {
    maxRetries: 1,
    initialDelay: 500,
    timeout: 15000,
  })

  return response.item
}