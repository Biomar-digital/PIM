// Data model for BioMar Product Information.
//
// One Product = one master record. Global information (identity, classification, technical
// details, tagline, hero image) lives on the product and is the same in every locale.
// Each locale where the product is sold can have its own local version of the marketing copy.

export type Status = 'draft' | 'in_review' | 'approved'

export type Role = 'admin' | 'global_editor' | 'approver' | 'local_editor' | 'viewer'

export interface User {
  id: string
  name: string
  title: string
  role: Role
  /** Locale ids (e.g. "da-DK") the person works in. Global roles have access to every locale. */
  locales: string[]
  /** Locale the PIM opens in: "global" or one of `locales` */
  defaultLocale: string
}

/** Workflow state of a block of content (the global record, or one locale version). */
export interface Meta {
  status: Status
  updatedBy: string
  updatedAt: string
  /** Set when an approver sends content back. Cleared on the next submit. */
  reviewNote?: string
}

/** Marketing copy that each locale can adapt. */
export interface LocalCopy {
  shortDescription: string
  description: string
  keyBenefits: string[]
  sellingPoints: string[]
}

/** Global English copy: the adaptable copy plus the tagline, which is the same in every locale. */
export interface Copy extends LocalCopy {
  tagline: string
}

export interface GlobalContent extends Copy {
  /** Goes up by one each time the global record is approved. Locale versions record the version they were checked against. */
  version: number
}

export type WebsiteStatus = 'live' | 'not_live'

/** The local version of a product for one locale (e.g. "da-DK"). */
export interface Variant extends LocalCopy {
  notes: string
  /** The locale uses the global English copy as it is (English-language markets). */
  inheritsGlobal: boolean
  /** Tracked by hand. The website manages its own publishing. */
  websiteStatus: WebsiteStatus
  /** Global version this local copy was last written or checked against. Lower than the global version = needs review. */
  sourceVersion: number
  /** Approved version number of this local copy (0 = never approved) */
  version: number
  /** Text of the last approved version, to show approvers what changed and to export approved content. */
  approved?: LocalCopy
  meta: Meta
}

/** Snapshot of an approved global version: the copy, plus product details when known. */
export type VersionText = Copy & Partial<Record<DetailField, unknown>>

export type AssetType = 'hero' | 'image' | 'bag' | 'logo' | 'brochure' | 'datasheet' | 'document'

/**
 * A reference to an asset. The file itself lives in The Pond (BioMar's DAM); the PIM keeps the link,
 * what the asset is for, and which locale it belongs to.
 */
export interface AssetRef {
  id: string
  type: AssetType
  title: string
  /** "global" or a locale id */
  scope: string
  /** Link to the asset in The Pond. Empty = not linked yet. */
  pondUrl: string
  /** Preview image bundled with the prototype (path inside src/assets), until The Pond can serve previews */
  preview?: string
  fileName?: string
  /** Where a bundled preview was taken from */
  sourceUrl?: string
  addedBy: string
  addedAt: string
}

/** 'global', 'assets' or a locale id */
export type Section = string

export type HistoryAction =
  | 'created' | 'edited' | 'minor_update' | 'submitted' | 'approved' | 'changes_requested' | 'restored' | 'reviewed'
  | 'asset_added' | 'asset_removed' | 'asset_linked' | 'market_added' | 'market_removed' | 'variant_created'

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
  /** Workflow state of the global record (details + global English copy) */
  status: Meta
  content: GlobalContent
  /** Global text of each approved version, keyed by version number. */
  versions?: Record<string, VersionText>
  /** Locale ids where the product is available */
  markets: string[]
  variants: Record<string, Variant>
  assets: AssetRef[]
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

/** Fields each locale can adapt */
export const LOCAL_FIELDS = ['shortDescription', 'description', 'keyBenefits', 'sellingPoints'] as const
export type LocalField = (typeof LOCAL_FIELDS)[number]
