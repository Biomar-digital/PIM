// Product logos from the BioMar brand logo packs (imported by scripts/import_logos.py).
// Logos are inlined as data URIs so they also work inside generated SVG artwork.
import index from '../assets/logos/index.json'
import type { Product } from '../types'

const files = import.meta.glob('../assets/logos/*.png', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>
const byFile: Record<string, string> = Object.fromEntries(Object.entries(files).map(([k, v]) => [k.split('/').pop()!, v]))
const LOGOS = index as Record<string, { label: string; colour: string; file: string }>

export interface Logo { key: string; label: string; url: string }

/** Same normalisation as scripts/import_logos.py: '+' reads as PLUS, other punctuation is dropped. */
const norm = (s: string) => s.toUpperCase().replace(/\+/g, 'PLUS').replace(/[^A-Z0-9]/g, '')

function get(key: string): Logo | null {
  const e = LOGOS[key]
  const url = e && byFile[e.file]
  return url ? { key, label: e.label, url } : null
}

export const BIOMAR_LOGO = get('BIOMAR')

/**
 * Most specific logo for a product: product name + species (e.g. INICIO PLUS + SHRIMP, SYMBIO LUMPFISH),
 * then product name (INICIO PLUS M), then the range (LARVIVA). Null when no logo exists yet.
 */
export function logoFor(p: Pick<Product, 'name' | 'species' | 'range'>): Logo | null {
  const name = norm(p.name)
  const candidates = [name + norm(p.species), name, norm(p.range)]
  for (const c of candidates) {
    const l = get(c)
    if (l) return l
  }
  return null
}
