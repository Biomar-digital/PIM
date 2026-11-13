// Derived views for the dashboard and the product library: what needs attention, per locale.
import type { Product, User } from '../types'
import { GLOBAL, MARKETS, isGroup, marketLabel, scopeLocales } from './reference'
import { can, isAvailable, localeState, missingInfo, missingLocalCopy, variantGaps, type LocaleState } from './rules'

/** Products shown in a selection: all products for Global, otherwise those available in at least one of its markets. */
export function productsIn(products: Product[], scope: string) {
  if (scope === GLOBAL) return products
  const locs = scopeLocales(scope)
  return products.filter((p) => p.markets.some((m) => locs.includes(m)))
}

/** Markets of a selection where this product is available (Global: all of them) */
export const marketsIn = (p: Product, scope: string) => (scope === GLOBAL ? p.markets : scopeLocales(scope).filter((l) => p.markets.includes(l)))

/**
 * Attention filters, shared by the dashboard tiles and the product library (?show=...),
 * so a number on the dashboard always opens exactly that list.
 */
export type Attention = 'missing_copy' | 'needs_review' | 'in_review' | 'draft' | 'missing_info' | 'approved'

export const ATTENTION_LABEL: Record<Attention, string> = {
  missing_copy: 'Missing local copy',
  needs_review: 'Needs review',
  in_review: 'Awaiting approval',
  draft: 'Drafts',
  missing_info: 'Missing information or assets',
  approved: 'Approved',
}

/** Does a product match an attention filter in this locale? In Global, local states count across every locale. */
export function matches(p: Product, loc: string, a: Attention): boolean {
  const locales = marketsIn(p, loc)
  const any = (st: string) => locales.some((l) => localeState(p, l) === st)
  switch (a) {
    case 'missing_copy': return (loc === GLOBAL && !p.content.description.trim()) || locales.some((l) => missingLocalCopy(p, l))
    case 'needs_review': return any('needs_review')
    case 'in_review': return (loc === GLOBAL && p.status.status === 'in_review') || any('in_review')
    case 'draft': return loc === GLOBAL ? p.status.status === 'draft' : any('draft')
    case 'missing_info': return missingInfo(p)
    case 'approved': return loc === GLOBAL ? p.status.status === 'approved' : any('approved')
  }
}

export function attentionCounts(products: Product[], loc: string): Record<Attention, number> {
  const out: Record<Attention, number> = { missing_copy: 0, needs_review: 0, in_review: 0, draft: 0, missing_info: 0, approved: 0 }
  for (const p of productsIn(products, loc)) for (const a of Object.keys(out) as Attention[]) if (matches(p, loc, a)) out[a]++
  return out
}

/* ---------------- Work list ---------------- */

export interface WorkItem {
  key: string
  product: Product
  locale: string
  title: string
  detail: string
  tone: 'approve' | 'sent_back' | 'update' | 'missing' | 'draft'
  at?: string
}

/** What this person should do next in the selected market, region or division, most urgent first. */
export function workItems(products: Product[], user: User, scope: string): WorkItem[] {
  if (isGroup(scope)) {
    // A region: the tasks of every market in it, each labelled with its market
    return scopeLocales(scope)
      .flatMap((l) => workItems(products, user, l).map((w) => ({ ...w, key: `${w.key}-${l}`, detail: `${marketLabel(l, true)}: ${w.detail}` })))
      .sort((a, b) => ORDER[a.tone] - ORDER[b.tone] || (b.at ?? '').localeCompare(a.at ?? ''))
  }
  const loc = scope
  const items: WorkItem[] = []
  const editable = can.editLocale(user, loc)
  for (const p of productsIn(products, loc)) {
    const meta = loc === GLOBAL ? p.status : p.variants[loc]?.meta
    // In Global, approvers also see local content waiting for them in every locale
    if (loc === GLOBAL && can.approve(user, GLOBAL)) {
      for (const l of p.markets) {
        const v = p.variants[l]
        if (v?.meta.status === 'in_review' && can.approve(user, l)) {
          items.push({ key: `a-${p.id}-${l}`, product: p, locale: l, title: 'Approve', detail: marketLabel(l), tone: 'approve', at: v.meta.updatedAt })
        }
      }
    }
    if (meta?.status === 'in_review' && can.approve(user, loc)) {
      items.push({ key: `a-${p.id}-${loc}`, product: p, locale: loc, title: 'Approve', detail: loc === GLOBAL ? 'Global record' : marketLabel(loc), tone: 'approve', at: meta.updatedAt })
    }
    if (!editable) continue
    if (meta?.status === 'draft' && meta.reviewNote) {
      items.push({ key: `s-${p.id}-${loc}`, product: p, locale: loc, title: 'Sent back to you', detail: `“${meta.reviewNote}”`, tone: 'sent_back', at: meta.updatedAt })
      continue
    }
    if (loc === GLOBAL) {
      if (p.owner !== user.id) continue
      if (p.status.status === 'draft') items.push({ key: `d-${p.id}`, product: p, locale: loc, title: 'Draft not sent for approval', detail: 'Global record', tone: 'draft', at: p.status.updatedAt })
      continue
    }
    const st = localeState(p, loc)
    const v = p.variants[loc]
    if (st === 'missing') items.push({ key: `n-${p.id}`, product: p, locale: loc, title: 'Local copy missing', detail: 'Not started', tone: 'missing' })
    else if (st === 'needs_review') items.push({ key: `u-${p.id}`, product: p, locale: loc, title: 'Global content changed', detail: 'Review your local copy', tone: 'update', at: p.status.updatedAt })
    else if (st === 'draft') items.push({ key: `d-${p.id}`, product: p, locale: loc, title: 'Draft not sent for approval', detail: v && variantGaps(v).length ? `Add ${variantGaps(v).join(', ')}` : 'Ready to send', tone: 'draft', at: v?.meta.updatedAt })
    else if (v && variantGaps(v).length) items.push({ key: `g-${p.id}`, product: p, locale: loc, title: 'Local copy incomplete', detail: `Add ${variantGaps(v).join(', ')}`, tone: 'missing' })
  }
  return items.sort((a, b) => ORDER[a.tone] - ORDER[b.tone] || (b.at ?? '').localeCompare(a.at ?? ''))
}
const ORDER = { approve: 0, sent_back: 1, update: 2, draft: 3, missing: 4 }

/* ---------------- Locale overview (Global dashboard) ---------------- */

export interface LocaleRow {
  id: string
  market: string
  language: string
  division: string
  region?: string
  total: number
  counts: Record<LocaleState, number>
  live: number
}

export function localeOverview(products: Product[], only?: string[]): LocaleRow[] {
  return MARKETS.filter((m) => !only || only.includes(m.id)).map((m) => {
    const counts: Record<LocaleState, number> = { approved: 0, in_review: 0, draft: 0, needs_review: 0, missing: 0, not_available: 0 }
    let total = 0
    let live = 0
    for (const p of products) {
      if (!isAvailable(p, m.id)) continue
      total++
      counts[localeState(p, m.id)]++
      if (p.variants[m.id]?.websiteStatus === 'live') live++
    }
    return { ...m, total, counts, live }
  })
}

/** Latest changes in a locale (Global shows global changes and every locale) */
export function recentChanges(products: Product[], loc: string, n = 8) {
  const out: { product: Product; at: string; by: string; summary: string; section: string }[] = []
  for (const p of productsIn(products, loc)) {
    for (const h of p.history.slice(0, 6)) {
      if (loc !== GLOBAL && !scopeLocales(loc).includes(h.section) && h.section !== GLOBAL && h.section !== 'assets') continue
      out.push({ product: p, at: h.at, by: h.by, summary: h.summary, section: h.section })
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, n)
}
