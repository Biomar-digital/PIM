// Word-level differences between two versions of a text, and item-level differences between lists.

export type Part = { text: string; kind: 'same' | 'added' | 'removed' }

/** Longest common subsequence table, returned as a function that walks it. */
function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): { kind: Part['kind']; item: T }[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: { kind: Part['kind']; item: T }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { out.push({ kind: 'same', item: b[j] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: 'removed', item: a[i++] })
    else out.push({ kind: 'added', item: b[j++] })
  }
  while (i < n) out.push({ kind: 'removed', item: a[i++] })
  while (j < m) out.push({ kind: 'added', item: b[j++] })
  return out
}

/**
 * Word-level difference. Within each changed stretch, all removed words come first and then all
 * added words, so a replaced phrase reads as "old phrase → new phrase" instead of alternating words.
 */
export function diffText(before: string, after: string): Part[] {
  const words = (t: string) => t.split(/\s+/).filter(Boolean)
  const steps = lcs(words(before), words(after), (x, y) => x === y)
  const parts: Part[] = []
  const push = (kind: Part['kind'], ws: string[]) => {
    if (!ws.length) return
    const last = parts.at(-1)
    const text = ws.join(' ')
    if (last && last.kind === kind) last.text += ' ' + text
    else parts.push({ kind, text: (parts.length ? ' ' : '') + text })
  }
  let removed: string[] = []
  let added: string[] = []
  const flush = () => { push('removed', removed); push('added', added); removed = []; added = [] }
  for (const st of steps) {
    if (st.kind === 'same') { flush(); push('same', [st.item]) }
    else if (st.kind === 'removed') removed.push(st.item)
    else added.push(st.item)
  }
  flush()
  return parts
}

export type ListPart = { kind: 'same' | 'added' | 'removed' | 'changed'; text: string; parts?: Part[] }

/** Items added, removed or reworded. A removed item followed by an added one is shown as a reworded item. */
export function diffList(before: string[], after: string[]): ListPart[] {
  const steps = lcs(before, after, (x, y) => x.trim() === y.trim())
  const out: ListPart[] = []
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k]
    const next = steps[k + 1]
    if (s.kind === 'removed' && next?.kind === 'added') {
      out.push({ kind: 'changed', text: next.item, parts: diffText(s.item, next.item) })
      k++
    } else out.push({ kind: s.kind, text: s.item })
  }
  return out
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? (Array.isArray(b) ? [] : '')) === JSON.stringify(b ?? (Array.isArray(a) ? [] : ''))
}

/** Field names whose values differ between two versions (only fields present in the old version are compared). */
export function changedFields<K extends string>(before: Partial<Record<K, unknown>> | undefined, after: Partial<Record<K, unknown>>, fields: readonly K[]): K[] {
  if (!before) return []
  return fields.filter((f) => f in before && !sameValue(before[f], after[f]))
}
