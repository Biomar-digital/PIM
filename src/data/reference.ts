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

/** "Norway (Norwegian)", or just "Norway" when short */
export function marketLabel(id: string, short = false): string {
  if (id === 'global') return short ? 'Global' : 'Global (English)'
  const m = MARKET_BY_ID[id]
  if (!m) return id
  return short ? m.market : `${m.market} (${m.language})`
}

export const RANGES = [
  'Blue Impact', 'Classic', 'CPK', 'DAN-EX', 'Ecolife', 'EFICO', 'EGGSTRA', 'ENERGY', 'EXIA', 'FINESTA', 'Golden', 'INICIO', 'INTRO', 'Label Rouge', 'LARVIVA', 'MAXIO', 'Ocean King', 'ORBIT', 'POWER', 'Rainbow', 'SIRCLE', 'SmartCare', 'Symbio', 'TRI-X',
]
/** Product categories as used on biomar.com */
export const CATEGORIES = [
  'Top performance', 'High Performance', 'Standard Performance', 'Health', 'Sustainability', 'Organic', 'RAS',
  'First feeding', 'Larval', 'Post larval/Weaning', 'Nursery', 'Live feed', 'Broodstock', 'Finisher', 'Water treatment',
]
/** Production stages as used on biomar.com (Hatchery Feed, Starter Feed and so on) */
export const STAGES = ['Hatchery', 'Starter', 'Transfer', 'Grower']
export const SPECIES = [
  'Arctic Char', 'Atlantic Salmon', 'Ballan Wrasse', 'Barramundi', 'Catfish', 'Chinook Salmon', 'Cobia', 'Cod', 'Coho Salmon', 'Eel', 'Golden Pompano', 'Grouper', 'Large Yellow Croaker', 'Largemouth Bass', 'Longfin Yellowtail', 'Lumpfish', 'Meagre', 'Murray Cod', 'Pike Perch', 'Red Drum', 'Red Sea Bream', 'Red Tilapia', 'Sea Bass', 'Sea Bream', 'Shrimp', 'Snapper', 'Sole', 'Striped Bass', 'Striped Catfish', 'Sturgeon', 'Tilapia', 'Totoaba', 'Triploid Salmon', 'Trout', 'Turbot', 'Whitefish', 'Yellowtail Kingfish',
]
export const FEED_TYPES = ['Extruded pellet', 'Sinking pellet', 'Microdiet', 'Crumble']

export const STATUS_LABEL: Record<Status, string> = { draft: 'Draft', in_review: 'In approval', approved: 'Approved' }

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  global_editor: 'Global editor',
  approver: 'Approver',
  local_editor: 'Local editor',
  viewer: 'Viewer',
}
export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: 'Full access, manages users, roles and markets.',
  global_editor: 'Maintains global product details, marketing copy and assets. Can edit every market.',
  approver: 'Approves global and local content, or sends it back with a note.',
  local_editor: 'Writes the translations and local files for their own markets and sends them for approval.',
  viewer: 'Finds, copies and downloads product content.',
}

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  active: 'Active', phasing_out: 'Phasing out', discontinued: 'Discontinued',
}

export const ASSET_TYPES: { id: AssetType; label: string; required: boolean; hint: string }[] = [
  { id: 'logo', label: 'Logo', required: true, hint: 'Product logo from the brand logo pack' },
  { id: 'bag', label: 'Packshot', required: true, hint: 'Image of the bag or packaging' },
  { id: 'datasheet', label: 'Technical datasheet', required: true, hint: 'PDF with the technical specification' },
  { id: 'photo', label: 'Product photos', required: false, hint: 'Pellets, farm and lifestyle photography' },
  { id: 'brochure', label: 'Brochures', required: false, hint: 'Sales and marketing material' },
  { id: 'other', label: 'Other files', required: false, hint: 'Certificates, presentations and anything else' },
]
export const ASSET_LABEL: Record<AssetType, string> = Object.fromEntries(ASSET_TYPES.map((a) => [a.id, a.label])) as Record<AssetType, string>

/** Labels for the marketing copy fields */
export const COPY_LABEL = {
  tagline: 'Tagline',
  shortDescription: 'Short description',
  description: 'Description',
  keyBenefits: 'Key benefits',
  sellingPoints: 'Selling points',
} as const
