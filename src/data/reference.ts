// Reference data: markets/languages, taxonomy, labels. Extend here when new markets or ranges are added.
import type { AssetType, Lifecycle, Role, Status } from '../types'

export interface Market {
  /** Locale id, same as the website culture code */
  id: string
  market: string
  language: string
  region: string
}

export const MARKETS: Market[] = [
  { id: 'nn-NO', market: 'Norway', language: 'Norwegian', region: 'Nordics' },
  { id: 'da-DK', market: 'Denmark', language: 'Danish', region: 'Nordics' },
  { id: 'sv-SE', market: 'Sweden', language: 'Swedish', region: 'Nordics' },
  { id: 'fi-FI', market: 'Finland', language: 'Finnish', region: 'Nordics' },
  { id: 'en-GB', market: 'United Kingdom', language: 'English', region: 'Europe' },
  { id: 'de-DE', market: 'Germany', language: 'German', region: 'Europe' },
  { id: 'pl-PL', market: 'Poland', language: 'Polish', region: 'Europe' },
  { id: 'fr-FR', market: 'France', language: 'French', region: 'Europe' },
  { id: 'es-ES', market: 'Spain', language: 'Spanish', region: 'Mediterranean' },
  { id: 'it-IT', market: 'Italy', language: 'Italian', region: 'Mediterranean' },
  { id: 'el-GR', market: 'Greece', language: 'Greek', region: 'Mediterranean' },
  { id: 'tr-TR', market: 'Türkiye', language: 'Turkish', region: 'Mediterranean' },
  { id: 'es-CL', market: 'Chile', language: 'Spanish', region: 'Americas' },
  { id: 'es-EC', market: 'Ecuador', language: 'Spanish', region: 'Americas' },
  { id: 'es-CR', market: 'Costa Rica', language: 'Spanish', region: 'Americas' },
  { id: 'en-AU', market: 'Australia', language: 'English', region: 'Asia-Pacific' },
  { id: 'vi-VN', market: 'Vietnam', language: 'Vietnamese', region: 'Asia-Pacific' },
  { id: 'en-PH', market: 'Philippines', language: 'English', region: 'Asia-Pacific' },
  { id: 'zh', market: 'China', language: 'Chinese', region: 'Asia-Pacific' },
]

export const MARKET_BY_ID: Record<string, Market> = Object.fromEntries(MARKETS.map((m) => [m.id, m]))
export const LANGUAGES = [...new Set(MARKETS.map((m) => m.language))].sort()

export function marketLabel(id: string, short = false): string {
  if (id === 'global') return short ? 'Global' : 'Global – English (master)'
  const m = MARKET_BY_ID[id]
  if (!m) return id
  return short ? m.market : `${m.market} – ${m.language}`
}

export const RANGES = [
  'POWER', 'Blue Impact', 'SmartCare', 'ORBIT', 'EFICO', 'INICIO', 'INTRO', 'CPK', 'LARVIVA',
  'MAXIO', 'EXIA', 'Ecolife', 'EGGSTRA', 'DAN-EX', 'FINESTA', 'Symbio', 'TRI-X',
]
export const CATEGORIES = [
  'Performance feed', 'Functional health feed', 'Low-impact feed', 'RAS feed', 'Starter feed',
  'Hatchery feed', 'Broodstock feed', 'Cleaner fish feed',
]
export const STAGES = ['Hatchery', 'Fry & fingerling', 'Smolt transfer', 'Grower']
export const SPECIES = [
  'Atlantic Salmon', 'Coho Salmon', 'Triploid Salmon', 'Trout', 'Arctic Char', 'Sea Bass', 'Sea Bream', 'Meagre', 'Sturgeon',
  'Shrimp', 'Tilapia', 'Eel', 'Lumpfish', 'Ballan Wrasse', 'Yellowtail Kingfish', 'Turbot', 'Barramundi',
]
export const FEED_TYPES = ['Extruded pellet', 'Sinking pellet', 'Microdiet', 'Crumble']

/** Brand-ish colour per range, used only for sample artwork. */
export const RANGE_COLORS: Record<string, string> = {
  POWER: '#c8102e', 'Blue Impact': '#0077c8', SmartCare: '#00857c', ORBIT: '#6b4fbb', EFICO: '#e87722',
  INICIO: '#d99a00', INTRO: '#5f9e1f', CPK: '#5c6f7b', LARVIVA: '#0093c9', MAXIO: '#a6192e', EXIA: '#c4006a',
  Ecolife: '#3a913f', EGGSTRA: '#e35205', 'DAN-EX': '#8a6d3b', FINESTA: '#b58500', Symbio: '#00a499', 'TRI-X': '#16a085',
}

export const STATUS_LABEL: Record<Status, string> = { draft: 'Draft', in_review: 'In review', approved: 'Approved' }

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  global_editor: 'Global editor',
  approver: 'Approver',
  local_editor: 'Local editor',
  viewer: 'Viewer',
}
export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: 'Full access, manages users, roles and markets.',
  global_editor: 'Maintains global product information, marketing copy and assets. Can edit any market.',
  approver: 'Reviews and approves global and local content. Can request changes.',
  local_editor: 'Contributes local content and assets for assigned markets and submits them for review.',
  viewer: 'Can find, preview and download approved content.',
}

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  active: 'Active', phasing_out: 'Phasing out', discontinued: 'Discontinued',
}

export const ASSET_TYPES: { id: AssetType; label: string; required: boolean; hint: string }[] = [
  { id: 'hero', label: 'Hero image', required: true, hint: 'Main product image used on websites and in presentations' },
  { id: 'bag', label: 'Product bag design', required: true, hint: 'Packaging artwork / packshot' },
  { id: 'datasheet', label: 'Technical datasheet', required: true, hint: 'PDF with technical specifications' },
  { id: 'highres', label: 'High-res image', required: false, hint: 'Print-quality photography' },
  { id: 'brochure', label: 'Brochure', required: false, hint: 'Sales and marketing material' },
  { id: 'other', label: 'Other', required: false, hint: 'Certificates, presentations, other files' },
]
export const ASSET_LABEL: Record<AssetType, string> = Object.fromEntries(ASSET_TYPES.map((a) => [a.id, a.label])) as Record<AssetType, string>
