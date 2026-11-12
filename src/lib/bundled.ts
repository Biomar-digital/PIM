// Real asset files shipped with the app, e.g. product packshots imported from biomar.com
// by scripts/fetch_bags.py.
import type { Asset } from '../types'

const files = import.meta.glob('../assets/bags/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const byName: Record<string, string> = Object.fromEntries(Object.entries(files).map(([k, v]) => [k.split('/').pop()!, v]))

export function bundledUrl(a: Asset): string | null {
  return a.file ? byName[a.file] ?? null : null
}
