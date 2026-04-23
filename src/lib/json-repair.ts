/**
 * Best-effort repair for truncated or mildly-malformed JSON strings.
 *
 * Context: Gemini's json-mode occasionally returns output that `JSON.parse`
 * rejects — usually because the response hit MAX_TOKENS mid-string, but also
 * because the model emitted an unescaped character or trailing comma. The
 * listing optimizer relies on rich JSON (title, description, itemSpecifics,
 * keywords, SEO); losing the whole response to a single bad quote drops the
 * item to a generic skeleton listing with empty itemSpecifics and seoScore 50.
 *
 * Strategy: single forward pass to find unclosed strings / brackets / braces,
 * close them at EOF, strip a trailing comma if present, then try `JSON.parse`.
 * Return null if the repair still doesn't parse — the caller falls back.
 *
 * This is deliberately conservative: we do NOT try to fix escape-sequence bugs
 * mid-string, mismatched brace types, or bad numeric literals. The downstream
 * shape validator + per-field coercion in ListingOptimizationService provide a
 * second guard against garbage that happens to parse.
 */
export function tryRepairJSON(raw: string): unknown | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Fast path — already valid.
  try {
    return JSON.parse(trimmed)
  } catch {
    // Fall through to repair.
  }

  // Walk the string tracking whether we're inside a string and what brackets
  // are open. `escape` is the "next char is literal" flag set by a backslash.
  let inString = false
  let escape = false
  const stack: Array<'{' | '['> = []

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]

    if (escape) {
      escape = false
      continue
    }

    if (inString) {
      if (c === '\\') {
        escape = true
      } else if (c === '"') {
        inString = false
      }
      continue
    }

    if (c === '"') {
      inString = true
    } else if (c === '{' || c === '[') {
      stack.push(c)
    } else if (c === '}' || c === ']') {
      const expected = c === '}' ? '{' : '['
      if (stack[stack.length - 1] === expected) stack.pop()
      // Mismatched closer → leave stack alone; JSON.parse will reject below.
    }
  }

  let repaired = trimmed
  if (inString) repaired += '"'

  // Strip a trailing comma that would otherwise invalidate the next close.
  repaired = repaired.replace(/,\s*$/, '')

  // Close any still-open structures in LIFO order.
  while (stack.length > 0) {
    const open = stack.pop()
    repaired += open === '{' ? '}' : ']'
  }

  try {
    return JSON.parse(repaired)
  } catch {
    return null
  }
}
