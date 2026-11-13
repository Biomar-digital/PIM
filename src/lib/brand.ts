// BioMar visual assets taken from biomar.com (scripts/fetch_brand_assets.py):
// species icons, country flags and aquaculture photography.
const species = import.meta.glob('../assets/brand/species/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const flags = import.meta.glob('../assets/brand/flags/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const photos = import.meta.glob('../assets/brand/photos/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const byName = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([k, v]) => [k.split('/').pop()!.replace(/\.[a-z]+$/, ''), v]))
const SPECIES = byName(species)
const FLAGS = byName(flags)
const PHOTOS = byName(photos)

/** Navy species icon from biomar.com, or null */
export const speciesIcon = (name: string): string | null => SPECIES[slug(name)] ?? (/salmon/i.test(name) ? SPECIES['atlantic-salmon'] : null) ?? null

/** Country flag for a market (locale id), or null */
export const flagFor = (locale: string): string | null => FLAGS[locale] ?? null

export type PhotoName = 'salmon-feeding-underwater' | 'salmon-underwater' | 'feed-farm' | 'pellets-in-hands' | 'salmon-farm'
export const photo = (name: PhotoName): string => PHOTOS[name]
