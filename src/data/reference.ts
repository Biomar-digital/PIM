// Reference data: locales, taxonomy, labels. Extend here when new locales or ranges are added.
import type { AssetType, Lifecycle, Role, Status } from '../types'

/** The locales of biomar.com. Ids are the website's culture codes; "global" is the global English site. */
/** The locales of biomar.com. Ids are the website's culture codes; "global" is the global English site. */
export interface Market {
  /** Locale id, same as the website culture code */
  id: string
  market: string
  language: string
  /** Division the market belongs to (d:...) */
  division: string
  /** Region inside the division, when the division has regions (EMEA) */
  region?: string
}

export const MARKETS: Market[] = [
  // Salmon Division
  { id: 'nn-NO', market: 'Norway', language: 'Norwegian', division: 'd:salmon' },
  { id: 'es-CL', market: 'Chile', language: 'Spanish', division: 'd:salmon' },
  { id: 'en-GB', market: 'United Kingdom', language: 'English', division: 'd:salmon' },
  { id: 'en-AU', market: 'Australia', language: 'English', division: 'd:salmon' },
  // LATAM, Shrimp and Hatchery Division
  { id: 'es-EC', market: 'Ecuador', language: 'Spanish', division: 'd:latam' },
  { id: 'en-PH', market: 'Philippines', language: 'English', division: 'd:latam' },
  { id: 'es-CR', market: 'Costa Rica', language: 'Spanish', division: 'd:latam' },
  // Asia Division
  { id: 'vi-VN', market: 'Vietnam', language: 'Vietnamese', division: 'd:asia' },
  { id: 'zh', market: 'China', language: 'Chinese', division: 'd:asia' },
  // EMEA Division
  { id: 'fr-FR', market: 'France', language: 'French', division: 'd:emea', region: 'r:westmed' },
  { id: 'es-ES', market: 'Spain', language: 'Spanish', division: 'd:emea', region: 'r:westmed' },
  { id: 'el-GR', market: 'Greece', language: 'Greek', division: 'd:emea', region: 'r:greece' },
  { id: 'tr-TR', market: 'Türkiye', language: 'Turkish', division: 'd:emea', region: 'r:turkey' },
  { id: 'da-DK', market: 'Denmark', language: 'Danish', division: 'd:emea', region: 'r:baltics' },
  { id: 'sv-SE', market: 'Sweden', language: 'Swedish', division: 'd:emea', region: 'r:baltics' },
  { id: 'fi-FI', market: 'Finland', language: 'Finnish', division: 'd:emea', region: 'r:baltics' },
  { id: 'de-DE', market: 'Germany', language: 'German', division: 'd:emea', region: 'r:baltics' },
  { id: 'pl-PL', market: 'Poland', language: 'Polish', division: 'd:emea', region: 'r:baltics' },
  { id: 'it-IT', market: 'Italy', language: 'Italian', division: 'd:emea', region: 'r:baltics' },
]

export const MARKET_BY_ID: Record<string, Market> = Object.fromEntries(MARKETS.map((m) => [m.id, m]))

export const GLOBAL = 'global'

/**
 * Divisions and regions: groups of markets that one marketing team looks after.
 * Selecting a group shows its markets together (dashboard, products, tasks).
 * Regions with a single market (Greece, Türkiye) are selected as that market.
 */
export interface Group {
  id: string
  name: string
  short: string
  kind: 'division' | 'region'
  division?: string
  locales: string[]
}

const marketsWhere = (f: (m: Market) => boolean) => MARKETS.filter(f).map((m) => m.id)

export const GROUPS: Group[] = [
  { id: 'd:salmon', name: 'Salmon Division', short: 'SAL', kind: 'division', locales: marketsWhere((m) => m.division === 'd:salmon') },
  { id: 'd:latam', name: 'LATAM, Shrimp and Hatchery Division', short: 'LAT', kind: 'division', locales: marketsWhere((m) => m.division === 'd:latam') },
  { id: 'd:asia', name: 'Asia Division', short: 'ASI', kind: 'division', locales: marketsWhere((m) => m.division === 'd:asia') },
  { id: 'd:emea', name: 'EMEA Division', short: 'EMEA', kind: 'division', locales: marketsWhere((m) => m.division === 'd:emea') },
  { id: 'r:westmed', name: 'West Med', short: 'WM', kind: 'region', division: 'd:emea', locales: marketsWhere((m) => m.region === 'r:westmed') },
  { id: 'r:baltics', name: 'Baltics', short: 'BAL', kind: 'region', division: 'd:emea', locales: marketsWhere((m) => m.region === 'r:baltics') },
]
export const GROUP_BY_ID: Record<string, Group> = Object.fromEntries(GROUPS.map((g) => [g.id, g]))
export const DIVISIONS = GROUPS.filter((g) => g.kind === 'division')

export const isGroup = (id: string) => id in GROUP_BY_ID
/** Markets behind a selection: a group's markets, or the market itself. Global = none (the master record). */
export const scopeLocales = (id: string): string[] => (id === GLOBAL ? [] : GROUP_BY_ID[id]?.locales ?? [id])
/** Region (or division) a market belongs to, as shown to people: "Baltics", "Salmon Division" */
export function marketGroup(id: string): Group | undefined {
  const m = MARKET_BY_ID[id]
  if (!m) return undefined
  return GROUP_BY_ID[m.region ?? ''] ?? GROUP_BY_ID[m.division]
}

/** Every market or group people can select, Global first */
export const LOCALE_IDS = [GLOBAL, ...MARKETS.map((m) => m.id)]
/** Short code shown in the picker, e.g. "DK", "BAL" */
export const localeCode = (id: string) => (id === GLOBAL ? 'GL' : GROUP_BY_ID[id]?.short ?? (id === 'zh' ? 'CN' : id.split('-')[1] ?? id.toUpperCase()))
/** Language of a locale */
export const localeLanguage = (id: string) => (id === GLOBAL ? 'English' : GROUP_BY_ID[id] ? `${GROUP_BY_ID[id].locales.length} markets` : MARKET_BY_ID[id]?.language ?? id)

/** "Norway (Norwegian)", or just "Norway" when short */
export function marketLabel(id: string, short = false): string {
  if (id === 'global') return short ? 'Global' : 'Global (English)'
  if (GROUP_BY_ID[id]) return GROUP_BY_ID[id].name
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
  admin: 'Everything a global editor can do, plus managing people and their access.',
  global_editor: 'Manages the global record (name, classification, tagline, hero image, technical details) and can edit every locale.',
  approver: 'Approves global and local content, or sends it back with a note.',
  local_editor: 'Adapts the marketing copy and adds local documents for their own locales, and sends them for approval.',
  viewer: 'Finds, copies and downloads approved product content.',
}
/** Roles that work across every locale */
export const GLOBAL_ROLES: Role[] = ['admin', 'global_editor', 'approver']

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  active: 'Active', phasing_out: 'Phasing out', discontinued: 'Discontinued',
}

/**
 * Asset types. `global` = managed by the global team only, the same in every locale.
 * The others can also be added per locale by the local team.
 */
export const ASSET_TYPES: { id: AssetType; label: string; plural: string; global: boolean; required: boolean; hint: string }[] = [
  { id: 'hero', label: 'Hero image', plural: 'Hero image', global: true, required: false, hint: 'The main product image, used everywhere' },
  { id: 'image', label: 'Product image', plural: 'High-resolution product images', global: true, required: false, hint: 'Pellets, farm and lifestyle photography' },
  { id: 'bag', label: 'Bag design', plural: 'Product bag designs', global: true, required: true, hint: 'Bag artwork and packshots' },
  { id: 'logo', label: 'Logo', plural: 'Logos', global: true, required: false, hint: 'Product logo from the brand logo pack' },
  { id: 'datasheet', label: 'Technical datasheet', plural: 'Technical datasheets and PDFs', global: false, required: false, hint: 'Technical specification' },
  { id: 'brochure', label: 'Brochure', plural: 'Brochures', global: false, required: false, hint: 'Sales and marketing material' },
  { id: 'document', label: 'Other document', plural: 'Other documents', global: false, required: false, hint: 'Certificates, presentations and anything else' },
]
export const ASSET_LABEL: Record<AssetType, string> = Object.fromEntries(ASSET_TYPES.map((a) => [a.id, a.label])) as Record<AssetType, string>

/** Labels for the marketing copy fields. The tagline is global; the rest can be adapted per locale. */
export const COPY_LABEL = {
  tagline: 'Tagline',
  shortDescription: 'Short description',
  description: 'Description',
  keyBenefits: 'Key benefits',
  sellingPoints: 'Selling points',
} as const
