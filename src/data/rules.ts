// Business rules: permissions, locale state and what is still missing. Pure functions, no UI.
import type { AssetType, Copy, LocalCopy, Product, Status, User, Variant } from '../types'
import { LOCAL_FIELDS } from '../types'
import { ASSET_TYPES, GLOBAL, GLOBAL_ROLES, GROUPS, GROUP_BY_ID, LOCALE_IDS } from './reference'

/* ---------------- Permissions ---------------- */

export const isGlobalUser = (u: User) => GLOBAL_ROLES.includes(u.role)

export const can = {
  /** Select a market, region or division and see its content. Everyone can see Global, the master record. */
  viewLocale: (u: User, loc: string) =>
    loc === GLOBAL || isGlobalUser(u) || (GROUP_BY_ID[loc] ? GROUP_BY_ID[loc].locales.every((l) => u.locales.includes(l)) : u.locales.includes(loc)),
  /** Global record: name, classification, technical details, tagline, hero image, global English copy */
  editGlobal: (u: User) => u.role === 'admin' || u.role === 'global_editor',
  /** Local copy of one locale */
  editLocale: (u: User, loc: string) =>
    loc === GLOBAL ? can.editGlobal(u) : u.role === 'admin' || u.role === 'global_editor' || (u.role === 'local_editor' && u.locales.includes(loc)),
  approve: (u: User, loc: string) => u.role === 'admin' || (u.role === 'approver' && (u.locales.length === 0 || loc === GLOBAL || u.locales.includes(loc))),
  /** Add or remove an asset of this type in this scope ("global" or a locale) */
  manageAsset: (u: User, type: AssetType, scope: string) => {
    const t = ASSET_TYPES.find((a) => a.id === type)
    if (scope === GLOBAL || t?.global) return can.editGlobal(u)
    return can.editLocale(u, scope)
  },
  setAvailability: (u: User) => can.editGlobal(u),
  createProduct: (u: User) => can.editGlobal(u),
  manageUsers: (u: User) => u.role === 'admin',
}

/** Markets a person can select, Global first */
export const userLocales = (u: User) => LOCALE_IDS.filter((l) => can.viewLocale(u, l))
/** Regions and divisions a person can select */
export const userGroups = (u: User) => GROUPS.filter((g) => can.viewLocale(u, g.id))

/** Locales a person edits (not Global) */
export const editableLocales = (u: User) => LOCALE_IDS.filter((l) => l !== GLOBAL && can.editLocale(u, l))

/* ---------------- Locale state ---------------- */

/**
 * State of a product's content in one locale, as people see it.
 * missing = available in the locale, but no local copy yet
 * needs_review = approved, but the global content changed since it was last checked
 */
export type LocaleState = Status | 'needs_review' | 'missing' | 'not_available'

export const LOCALE_STATE_LABEL: Record<LocaleState, string> = {
  not_available: 'Not available',
  missing: 'Missing',
  needs_review: 'Needs review',
  draft: 'Draft',
  in_review: 'In approval',
  approved: 'Approved',
}

export const isAvailable = (p: Product, loc: string) => loc === GLOBAL || p.markets.includes(loc)

/** The global content changed (and was approved) after this local copy was written or last checked. */
export function isOutdated(p: Product, v: Variant): boolean {
  return !v.inheritsGlobal && v.sourceVersion < p.content.version
}

export function localeState(p: Product, loc: string): LocaleState {
  if (loc === GLOBAL) return p.status.status
  if (!p.markets.includes(loc)) return 'not_available'
  const v = p.variants[loc]
  if (!v) return 'missing'
  if (v.meta.status === 'approved' && isOutdated(p, v)) return 'needs_review'
  return v.meta.status
}

/** Text a local version still lacks (nothing when it uses the English text). */
export function variantGaps(v: Variant): string[] {
  if (v.inheritsGlobal) return []
  const out: string[] = []
  if (!v.shortDescription.trim()) out.push('short description')
  if (!v.description.trim()) out.push('description')
  if (v.keyBenefits.filter(Boolean).length === 0) out.push('key benefits')
  return out
}

/** No local copy, or the main local text is missing */
export const missingLocalCopy = (p: Product, loc: string) => {
  if (loc === GLOBAL || !p.markets.includes(loc)) return false
  const v = p.variants[loc]
  return !v || variantGaps(v).length > 0
}

/* ---------------- Approved content (what people may copy and export) ---------------- */

/** The latest approved global copy, or the current copy when nothing was approved yet. */
export function approvedGlobal(p: Product): { copy: Copy; version: number; approved: boolean } {
  const v = p.versions?.[p.content.version]
  if (v) return { copy: { tagline: v.tagline, shortDescription: v.shortDescription, description: v.description, keyBenefits: v.keyBenefits, sellingPoints: v.sellingPoints }, version: p.content.version, approved: true }
  return { copy: p.content, version: p.content.version, approved: false }
}

const pickLocal = (c: LocalCopy): LocalCopy => ({ shortDescription: c.shortDescription, description: c.description, keyBenefits: c.keyBenefits, sellingPoints: c.sellingPoints })

/**
 * Approved content for a locale, ready to copy or export.
 * The tagline always comes from the global record. Local copy comes from the last approved local version;
 * when there is none, the global English copy is used and `fallback` says so.
 */
export function approvedContent(p: Product, loc: string): { copy: Copy; fallback: boolean; current: boolean } {
  const g = approvedGlobal(p)
  if (loc === GLOBAL) return { copy: g.copy, fallback: false, current: g.approved && p.status.status === 'approved' }
  const v = p.variants[loc]
  if (v?.inheritsGlobal) return { copy: g.copy, fallback: false, current: true }
  const local = v?.meta.status === 'approved' ? pickLocal(v) : v?.approved
  if (!local) return { copy: g.copy, fallback: true, current: false }
  return { copy: { tagline: g.copy.tagline, ...local }, fallback: false, current: v?.meta.status === 'approved' }
}

/** Current (possibly unapproved) local copy, for editors */
export function workingCopy(p: Product, loc: string): LocalCopy | null {
  if (loc === GLOBAL) return pickLocal(p.content)
  const v = p.variants[loc]
  return v ? pickLocal(v) : null
}

export const LOCAL_FIELD_LIST = LOCAL_FIELDS

/* ---------------- Missing information ---------------- */

export type TodoArea = 'details' | 'copy' | 'assets' | 'locales'

export interface Todo {
  id: string
  area: TodoArea
  label: string
  locale?: string
  kind: 'missing' | 'update'
  /** Needed before the product is ready to use */
  essential: boolean
}

/** What a product must have before it is ready to use: the core marketing copy and a product image (the bag design). */
const ESSENTIAL = new Set(['tagline', 'shortDescription', 'description', 'keyBenefits', 'asset-bag'])

/** Everything the global record still needs. */
export function todos(p: Product): Todo[] {
  const out: Todo[] = []
  const add = (area: TodoArea, id: string, label: string, ok: boolean) => { if (!ok) out.push({ id, area, label, kind: 'missing', essential: ESSENTIAL.has(id) }) }
  const c = p.content
  add('copy', 'tagline', 'Tagline', !!c.tagline.trim())
  add('copy', 'shortDescription', 'Short description', !!c.shortDescription.trim())
  add('copy', 'description', 'Description', !!c.description.trim())
  add('copy', 'keyBenefits', 'Key benefits', c.keyBenefits.filter(Boolean).length > 0)
  add('copy', 'sellingPoints', 'Selling points', c.sellingPoints.filter(Boolean).length > 0)
  add('details', 'code', 'Product code', !!p.code.trim())
  add('details', 'feedType', 'Feed type', !!p.feedType.trim())
  add('details', 'pelletSizes', 'Pellet sizes', p.pelletSizes.length > 0)
  add('details', 'packaging', 'Packaging', p.packaging.length > 0)
  for (const t of ASSET_TYPES.filter((a) => a.id === 'hero' || a.id === 'bag' || a.id === 'datasheet')) {
    add('assets', `asset-${t.id}`, t.label, p.assets.some((a) => a.type === t.id && a.scope === GLOBAL))
  }
  return out
}

/** Essential items still missing on the global record */
export const essentialTodos = (p: Product) => todos(p).filter((t) => t.essential)
export const missingInfo = (p: Product) => essentialTodos(p).length > 0

/** Approved, and nothing essential missing: markets can use it. */
export const isReady = (p: Product) => p.status.status === 'approved' && !missingInfo(p)

export function lastUpdated(p: Product, loc?: string): { at: string; by: string } {
  if (loc && loc !== GLOBAL) {
    const v = p.variants[loc]
    if (v) return { at: v.meta.updatedAt, by: v.meta.updatedBy }
  }
  return { at: p.status.updatedAt, by: p.status.updatedBy }
}
