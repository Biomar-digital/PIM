// Data model for The Product Hatchery, BioMar product information.
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

export type AssetType =
  | 'hero' | 'image' | 'bag' | 'logo' | 'video' | 'presentation' | 'article' | 'social'
  | 'trial' | 'datasheet' | 'brochure' | 'spreadsheet' | 'document'

/** Where an uploaded file is kept: the artifact's file store, the shared database (in parts), or this browser */
export interface StoredFile {
  store: 'asset' | 'db' | 'local'
  ref: string
  name: string
  size: number
  mime: string
}

/**
 * A file or piece of content related to a product. One item can appear in several places
 * (Assets, Content, Internal information) without being added twice.
 * It is either a link to The Pond, a link to another page, an uploaded file, or text written in the PIM.
 */
export interface AssetRef {
  id: string
  type: AssetType
  title: string
  description?: string
  /** "global" or a locale id */
  scope: string
  /** Date the item belongs to (YYYY-MM-DD), e.g. when a trial ended or an article was published */
  date?: string
  /** For internal use only, not for publishing */
  internal?: boolean
  /** Link to the asset in The Pond. Empty = not linked yet. */
  pondUrl: string
  /** Link to another page (SharePoint, YouTube, LinkedIn...) */
  url?: string
  /** Uploaded file */
  file?: StoredFile
  /** Text written in the PIM (article drafts, social media posts) */
  body?: string
  /** Preview image bundled with the prototype (path inside src/assets) */
  preview?: string
  fileName?: string
  /** Where a bundled preview was taken from */
  sourceUrl?: string
  addedBy: string
  addedAt: string
  updatedAt?: string
}

/* ---------- Internal information ---------- */

export type InternalSection = 'presentations' | 'technical' | 'trials' | 'positioning' | 'other'

/** A note in the Internal information tab: free text, optionally with related files */
export interface InternalNote {
  id: string
  section: InternalSection
  /** "global" or a locale id */
  scope: string
  title: string
  body: string
  /** Related items from the product's assets */
  resourceIds: string[]
  updatedBy: string
  updatedAt: string
}

export type MarketAvailability = '' | 'available' | 'on_request' | 'phasing_out' | 'not_sold'

/** What is sold in one market: availability, pellet sizes and formats, notes */
export interface MarketInfo {
  status: MarketAvailability
  pelletSizes: string[]
  packaging: string[]
  notes: string
  updatedBy: string
  updatedAt: string
}

export interface InternalInfo {
  notes: InternalNote[]
  markets: Record<string, MarketInfo>
}

/* ---------- Tagging people ---------- */

export type TagKind = 'review' | 'translate' | 'approve' | 'update' | 'fyi'

/** A request to a person about a product: "please review the Danish description" */
export interface TagRequest {
  id: string
  to: string
  from: string
  kind: TagKind
  /** "global" or a locale id */
  locale: string
  /** What it is about, e.g. "Description" or "Assets" */
  about: string
  message: string
  /** Optional due date (YYYY-MM-DD) */
  due?: string
  status: 'open' | 'done'
  createdAt: string
  doneAt?: string
}

/** 'global', 'assets' or a locale id */
export type Section = string

export type HistoryAction =
  | 'created' | 'edited' | 'minor_update' | 'submitted' | 'approved' | 'changes_requested' | 'restored' | 'reviewed'
  | 'asset_added' | 'asset_removed' | 'asset_linked' | 'asset_edited' | 'market_added' | 'market_removed' | 'variant_created'
  | 'internal_edited' | 'tagged' | 'request_done'

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
  /** Internal information: not published, for marketing, product and sales teams */
  internal?: InternalInfo
  /** People tagged to do something on this product */
  requests?: TagRequest[]
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
