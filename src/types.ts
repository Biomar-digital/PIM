// Core data model for the BioMar PIM.
// One Product = one global master record. Market/language variants hang off it.

export type Status = 'draft' | 'in_review' | 'approved'

export type Role = 'admin' | 'global_editor' | 'approver' | 'local_editor' | 'viewer'

export interface User {
  id: string
  name: string
  title: string
  role: Role
  /** Locale ids (e.g. "nn-NO") the user is responsible for. Empty = all / global. */
  markets: string[]
}

/** Workflow metadata carried by every editable content block. */
export interface Meta {
  status: Status
  updatedBy: string
  updatedAt: string
  /** Set when an approver sends content back. Cleared on next submit. */
  reviewNote?: string
}

export interface MarketingContent {
  shortDescription: string
  tagline: string
  description: string
  keyBenefits: string[]
  sellingPoints: string[]
  /** Incremented each time global marketing content is approved. Variants record which version they were based on. */
  version: number
  meta: Meta
}

export type WebsiteStatus = 'live' | 'not_live'

/** A market + language specific variation of a product (keyed by locale, e.g. "nn-NO"). */
export interface Variant {
  localName: string
  shortDescription: string
  tagline: string
  description: string
  keyBenefits: string[]
  sellingPoints: string[]
  notes: string
  /** True when the market deliberately uses the global (English) copy as-is. */
  inheritsGlobal: boolean
  /** Tracked manually - the website manages its own publishing. */
  websiteStatus: WebsiteStatus
  /** Global marketing version this variant was written/checked against. */
  sourceVersion: number
  meta: Meta
}

export type AssetType = 'hero' | 'highres' | 'bag' | 'datasheet' | 'brochure' | 'other'

export interface Asset {
  id: string
  type: AssetType
  fileName: string
  mime: string
  sizeKb: number
  /** "global" or a locale id */
  scope: string
  /**
   * "bundled" = real file shipped with the app (e.g. packshots imported from biomar.com),
   * "generated" = sample artwork rendered by the app, "upload" = file stored in the browser
   */
  source: 'bundled' | 'generated' | 'upload'
  /** Bundled file name in src/assets/bags */
  file?: string
  /** Where a bundled file was imported from */
  sourceUrl?: string
  uploadedBy: string
  uploadedAt: string
}

export type Section = 'info' | 'marketing' | 'assets' | string // string = locale id for a variant

export type HistoryAction =
  | 'created' | 'edited' | 'submitted' | 'approved' | 'changes_requested'
  | 'restored' | 'asset_added' | 'asset_removed' | 'market_added' | 'market_removed' | 'variant_created'

export interface HistoryEntry {
  id: string
  at: string
  by: string
  section: Section
  action: HistoryAction
  summary: string
  /** Copy of the section content after the change - used to view and restore old versions. */
  snapshot?: Record<string, unknown>
}

export type Lifecycle = 'active' | 'phasing_out' | 'discontinued'

export interface Product {
  id: string
  code: string
  name: string
  species: string
  range: string
  category: string
  stages: string[]
  feedType: string
  pelletSizes: string[]
  packaging: string[]
  regulatoryNotes: string
  /** Fields still holding illustrative sample values (not from the website import). Cleared field by field on edit. */
  sampleFields?: string[]
  owner: string
  lifecycle: Lifecycle
  info: Meta
  marketing: MarketingContent
  /** Locale ids of the markets this product is sold in (= variants that should exist). */
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

/** Fields of the global product information block (used by forms and history snapshots). */
export const INFO_FIELDS = [
  'name', 'species', 'range', 'category', 'stages', 'feedType', 'pelletSizes',
  'packaging', 'code', 'owner', 'lifecycle', 'regulatoryNotes',
] as const
export type InfoField = (typeof INFO_FIELDS)[number]

export const MARKETING_FIELDS = ['tagline', 'shortDescription', 'description', 'keyBenefits', 'sellingPoints'] as const
export type MarketingField = (typeof MARKETING_FIELDS)[number]
