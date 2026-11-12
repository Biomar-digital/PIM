// Business rules: permissions, market version state and what is still missing. Pure functions, no UI.
import type { Product, Status, User, Variant } from '../types'
import { ASSET_TYPES, marketLabel } from './reference'

/* ---------------- Permissions ---------------- */

export const can = {
  editGlobal: (u: User) => u.role === 'admin' || u.role === 'global_editor',
  editMarket: (u: User, locale: string) =>
    u.role === 'admin' || u.role === 'global_editor' || (u.role === 'local_editor' && u.markets.includes(locale)),
  edit: (u: User, section: string) => (section === 'global' ? can.editGlobal(u) : can.editMarket(u, section)),
  approve: (u: User) => u.role === 'admin' || u.role === 'approver',
  createProduct: (u: User) => u.role === 'admin' || u.role === 'global_editor',
  manageUsers: (u: User) => u.role === 'admin',
}

/* ---------------- Market versions ---------------- */

/** State of a market version as people see it */
export type MarketState = Status | 'needs_update' | 'not_started'

export const MARKET_STATE_LABEL: Record<MarketState, string> = {
  not_started: 'Not started',
  needs_update: 'Needs update',
  draft: 'Draft',
  in_review: 'Waiting for approval',
  approved: 'Approved',
}

export function isOutdated(p: Product, v: Variant): boolean {
  return !v.inheritsGlobal && v.sourceVersion < p.content.version
}

export function marketState(p: Product, locale: string): MarketState {
  const v = p.variants[locale]
  if (!v) return 'not_started'
  if (v.meta.status === 'approved' && isOutdated(p, v)) return 'needs_update'
  return v.meta.status
}

/** Text a translation still lacks (nothing when the market uses the English text). */
export function variantGaps(v: Variant): string[] {
  if (v.inheritsGlobal) return []
  const out: string[] = []
  if (!v.description.trim()) out.push('description')
  if (!v.shortDescription.trim()) out.push('short description')
  if (v.keyBenefits.filter(Boolean).length === 0) out.push('key benefits')
  return out
}

/* ---------------- To do ---------------- */

export type TodoArea = 'details' | 'copy' | 'files' | 'markets'

export const TODO_AREA_LABEL: Record<TodoArea, string> = {
  details: 'Product details',
  copy: 'Marketing copy',
  files: 'Files',
  markets: 'Translations',
}

export interface Todo {
  id: string
  area: TodoArea
  label: string
  /** For translation items */
  locale?: string
  /** 'update' = exists but has to be checked again */
  kind: 'missing' | 'update'
}

/** Everything a product still needs, in the order people usually fill it in. */
export function todos(p: Product): Todo[] {
  const out: Todo[] = []
  const add = (area: TodoArea, id: string, label: string, ok: boolean) => { if (!ok) out.push({ id, area, label, kind: 'missing' }) }
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
  add('details', 'categories', 'Category', p.categories.length > 0)
  for (const t of ASSET_TYPES.filter((a) => a.required)) {
    add('files', `file-${t.id}`, t.label, p.assets.some((a) => a.type === t.id && a.scope === 'global'))
  }
  for (const loc of p.markets) {
    const st = marketState(p, loc)
    const v = p.variants[loc]
    if (st === 'not_started') out.push({ id: `m-${loc}`, area: 'markets', label: `${marketLabel(loc)}: not started`, locale: loc, kind: 'missing' })
    else if (st === 'needs_update') out.push({ id: `m-${loc}`, area: 'markets', label: `${marketLabel(loc)}: check against the new global text`, locale: loc, kind: 'update' })
    else if (v && variantGaps(v).length) out.push({ id: `m-${loc}`, area: 'markets', label: `${marketLabel(loc)}: add ${variantGaps(v).join(', ')}`, locale: loc, kind: 'missing' })
  }
  return out
}

export function lastUpdated(p: Product): string {
  const dates = [p.status.updatedAt, ...Object.values(p.variants).map((v) => v.meta.updatedAt)]
  return dates.sort().at(-1) ?? p.createdAt
}
