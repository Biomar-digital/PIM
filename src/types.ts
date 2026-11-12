// Data model for BioMar Product Information.
// One Product = one global record. Each market (locale) can have its own translated version.

export type Status = 'draft' | 'in_review' | 'approved'

export type Role = 'admin' | 'global_editor' | 'approver' | 'local_editor' | 'viewer'

export interface User {
  id: string
  name: string
  title: string
  role: Role
  /** Locale ids (e.g. "nn-NO") the user is responsible for. Empty = all markets. */
  markets: string[]
}

/** Workflow state of a block of content (the global content, or one market version). */
export interface Meta {
  status: Status
  updatedBy: string
  updatedAt: string
  /** Set when an approver sends content back. Cleared on the next submit. */
  reviewNote?: string
}

/** Marketing copy. The same shape is used for the global version and for each market version. */
export interface Copy {
  tagline: string
  shortDescription: string
  description: string
  keyBenefits: string[]
  sellingPoints: string[]
}

export interface GlobalContent extends Copy {
  /** Goes up by one each time the global content is approved. Market versions record the version they follow. */
  version: number
}

export type WebsiteStatus = 'live' | 'not_live'

/** A market and language version of a product, keyed by locale (e.g. "nn-NO"). */
export interface Variant extends Copy {
  localName: string
  notes: string
  /** The market uses the global English text as it is. */
  inheritsGlobal: boolean
  /** Tracked by hand. The website manages its own publishing. */
  websiteStatus: WebsiteStatus
  /** Global content version this translation follows. */
  sourceVersion: number
  meta: Meta
}

export type AssetType = 'logo' | 'bag' | 'photo' | 'datasheet' | 'brochure' | 'other'

export interface Asset {
  id: string
  type: AssetType
  fileName: string
  mime: string
  sizeKb: number
  /** "global" or a locale id */
  scope: string
  /** "bundled" = file shipped with the app (logos, packshots), "upload" = file stored in this browser */
  source: 'bundled' | 'upload'
  /** Path of a bundled file inside src/assets, e.g. "bags/power-atlantic-salmon.webp" */
  file?: string
  /** Where a bundled file was imported from */
  sourceUrl?: string
  uploadedBy: string
  uploadedAt: string
}

/** 'global', 'assets' or a locale id */
export type Section = string

export type HistoryAction =
  | 'created' | 'edited' | 'submitted' | 'approved' | 'changes_requested' | 'restored'
  | 'asset_added' | 'asset_removed' | 'market_added' | 'market_removed' | 'variant_created'

export interface HistoryEntry {
  id: string
  at: string
  by: string
  section: Section
  action: HistoryAction
  summary: string
  /** The content after the change, so earlier versions can be viewed and restored. */
  snapshot?: Record<string, unknown>
}

export type Lifecycle = 'active' | 'phasing_out' | 'discontinued'

export interface Product {
  id: string
  name: string
  species: string
  range: string
  categories: string[]
  stages: string[]
  code: string
  feedType: string
  pelletSizes: string[]
  packaging: string[]
  notes: string
  owner: string
  lifecycle: Lifecycle
  /** Page name on biomar.com */
  websiteSlug?: string
  /** Field -> biomar.com page the value was imported from (kept for reference) */
  sources?: Record<string, string>
  /** Workflow state of the global content (details + marketing copy) */
  status: Meta
  content: GlobalContent
  /** Locale ids of the markets where the product is sold */
  markets: string[]
  variants: Record<string, Variant>
  assets: Asset[]
  history: HistoryEntry[]
  createdAt: string
}

export interface Database {
  version: number
  users: User[]
  products: Product[]
}

export const DETAIL_FIELDS = [
  'name', 'species', 'range', 'categories', 'stages', 'code', 'feedType', 'pelletSizes', 'packaging',
  'owner', 'lifecycle', 'notes',
] as const
export type DetailField = (typeof DETAIL_FIELDS)[number]

export const COPY_FIELDS = ['tagline', 'shortDescription', 'description', 'keyBenefits', 'sellingPoints'] as const
export type CopyField = (typeof COPY_FIELDS)[number]
