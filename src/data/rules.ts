// Business rules: permissions, completeness and variant state. Pure functions, no UI.
import type { Product, Status, User, Variant } from '../types'
import { ASSET_TYPES } from './reference'

/* ---------------- Permissions ---------------- */

export const can = {
  editGlobal: (u: User) => u.role === 'admin' || u.role === 'global_editor',
  editMarket: (u: User, locale: string) =>
    u.role === 'admin' || u.role === 'global_editor' || (u.role === 'local_editor' && u.markets.includes(locale)),
  /** Edit the section shown in a context ('global' or a locale) */
  editContext: (u: User, ctx: string) => (ctx === 'global' ? can.editGlobal(u) : can.editMarket(u, ctx)),
  approve: (u: User) => u.role === 'admin' || u.role === 'approver',
  createProduct: (u: User) => u.role === 'admin' || u.role === 'global_editor',
  manageUsers: (u: User) => u.role === 'admin',
}

/* ---------------- Variant state ---------------- */

export type VariantState = 'missing' | 'outdated' | Status

export function variantState(p: Product, locale: string): VariantState {
  const v = p.variants[locale]
  if (!v) return 'missing'
  if (v.meta.status === 'approved' && isOutdated(p, v)) return 'outdated'
  return v.meta.status
}

export function isOutdated(p: Product, v: Variant): boolean {
  return !v.inheritsGlobal && v.sourceVersion < p.marketing.version
}

export const VARIANT_STATE_LABEL: Record<VariantState, string> = {
  missing: 'Missing', outdated: 'Outdated', draft: 'Draft', in_review: 'In review', approved: 'Approved',
}

/* ---------------- Overall status ---------------- */

/** Lowest workflow status across the global blocks (info + marketing). */
export function overallStatus(p: Product): Status {
  const s = [p.info.status, p.marketing.meta.status]
  if (s.includes('draft')) return 'draft'
  if (s.includes('in_review')) return 'in_review'
  return 'approved'
}

export function lastUpdated(p: Product): string {
  const dates = [p.info.updatedAt, p.marketing.meta.updatedAt, ...Object.values(p.variants).map((v) => v.meta.updatedAt)]
  return dates.sort().at(-1) ?? p.createdAt
}

/* ---------------- Completeness ---------------- */

export type CheckGroup = 'info' | 'marketing' | 'assets' | 'markets'
export interface Check {
  id: string
  group: CheckGroup
  label: string
  ok: boolean
  /** 'missing' = required info absent, 'outdated' = exists but needs review, 'incomplete' = variant lacks fields */
  problem?: 'missing' | 'outdated' | 'incomplete'
  locale?: string
}

export function completeness(p: Product): { score: number; checks: Check[]; missing: Check[] } {
  const m = p.marketing
  const checks: Check[] = [
    { id: 'name', group: 'info', label: 'Product name & code', ok: !!p.name && !!p.code },
    { id: 'classification', group: 'info', label: 'Range, category & species', ok: !!p.range && !!p.category && !!p.species },
    { id: 'stages', group: 'info', label: 'Production stage', ok: p.stages.length > 0 },
    { id: 'pellets', group: 'info', label: 'Pellet sizes', ok: p.pelletSizes.length > 0 },
    { id: 'packaging', group: 'info', label: 'Packaging', ok: p.packaging.length > 0 },
    { id: 'tagline', group: 'marketing', label: 'Tagline', ok: !!m.tagline.trim() },
    { id: 'short', group: 'marketing', label: 'Short description', ok: !!m.shortDescription.trim() },
    { id: 'description', group: 'marketing', label: 'Product description', ok: m.description.trim().length > 40 },
    { id: 'benefits', group: 'marketing', label: 'At least 3 key benefits', ok: m.keyBenefits.filter(Boolean).length >= 3 },
    { id: 'selling', group: 'marketing', label: 'Selling points', ok: m.sellingPoints.filter(Boolean).length > 0 },
  ]
  for (const t of ASSET_TYPES.filter((a) => a.required)) {
    checks.push({ id: `asset-${t.id}`, group: 'assets', label: t.label, ok: p.assets.some((a) => a.type === t.id && a.scope === 'global') })
  }
  for (const loc of p.markets) {
    const st = variantState(p, loc)
    const v = p.variants[loc]
    const incomplete = !!v && variantMissingFields(v).length > 0
    checks.push({
      id: `market-${loc}`, group: 'markets', locale: loc, label: loc,
      ok: st !== 'missing' && st !== 'outdated' && !incomplete,
      problem: st === 'missing' ? 'missing' : st === 'outdated' ? 'outdated' : incomplete ? 'incomplete' : undefined,
    })
  }
  for (const c of checks) if (!c.ok && !c.problem) c.problem = 'missing'
  const okCount = checks.filter((c) => c.ok).length
  return { score: Math.round((okCount / checks.length) * 100), checks, missing: checks.filter((c) => !c.ok) }
}

/** Fields a local variant must have (unless it deliberately uses the global copy). */
export function variantMissingFields(v: Variant): string[] {
  if (v.inheritsGlobal) return []
  const out: string[] = []
  if (!v.description.trim()) out.push('Description')
  if (!v.shortDescription.trim()) out.push('Short description')
  if (v.keyBenefits.filter(Boolean).length < 3) out.push('Key benefits')
  return out
}
