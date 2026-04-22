/**
 * Dedupe an array of {id} objects, keeping first occurrence.
 *
 * Queue + scanHistory can hold the same item (BUY items live in both: queue
 * as working list, scanHistory as permanent ledger). Every screen that merges
 * the two MUST dedupe or totals double-count.
 */
export function dedupById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}
