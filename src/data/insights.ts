// Derived views over the product data: work queues, coverage per market, review items.
import type { Product, Section, Status, User } from '../types'
import { MARKETS, marketLabel } from './reference'
import { can, completeness, variantMissingFields, variantState, type VariantState } from './rules'

export interface ReviewItem {
  product: Product
  section: Section
  status: Status
  updatedBy: string
  updatedAt: string
  reviewNote?: string
}

/** Every content block (global info, global marketing, each variant) as a flat list. */
export function allBlocks(products: Product[]): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const p of products) {
    out.push({ product: p, section: 'info', status: p.info.status, updatedBy: p.info.updatedBy, updatedAt: p.info.updatedAt, reviewNote: p.info.reviewNote })
    const m = p.marketing.meta
    out.push({ product: p, section: 'marketing', status: m.status, updatedBy: m.updatedBy, updatedAt: m.updatedAt, reviewNote: m.reviewNote })
    for (const [loc, v] of Object.entries(p.variants)) {
      out.push({ product: p, section: loc, status: v.meta.status, updatedBy: v.meta.updatedBy, updatedAt: v.meta.updatedAt, reviewNote: v.meta.reviewNote })
    }
  }
  return out
}

export interface WorkItem {
  key: string
  product: Product
  title: string
  detail: string
  tone: 'review' | 'missing' | 'outdated' | 'changes'
  /** where to go: tab + context */
  tab: string
  context: string
  at?: string
}

/** What the given user should look at next. */
export function workItems(products: Product[], user: User): WorkItem[] {
  const items: WorkItem[] = []
  const scope = (loc: string) => user.markets.length === 0 || user.markets.includes(loc)
  for (const b of allBlocks(products)) {
    const isLocal = b.section !== 'info' && b.section !== 'marketing'
    const tab = b.section === 'info' ? 'information' : 'marketing'
    const ctx = isLocal ? b.section : 'global'
    if (can.approve(user) && b.status === 'in_review' && (!isLocal || scope(b.section as string))) {
      items.push({ key: `r-${b.product.id}-${b.section}`, product: b.product, title: 'Waiting for your approval', detail: label(b.section), tone: 'review', tab, context: ctx, at: b.updatedAt })
    }
    if (b.status === 'draft' && b.reviewNote && (isLocal ? user.markets.includes(b.section as string) && can.editMarket(user, b.section as string) : can.editGlobal(user))) {
      items.push({ key: `c-${b.product.id}-${b.section}`, product: b.product, title: 'Changes requested', detail: `${label(b.section)}: “${b.reviewNote}”`, tone: 'changes', tab, context: ctx, at: b.updatedAt })
    }
  }
  if (user.role === 'local_editor') {
    for (const p of products) {
      for (const loc of p.markets.filter((l) => user.markets.includes(l))) {
        const st = variantState(p, loc)
        const v = p.variants[loc]
        if (st === 'missing') items.push({ key: `m-${p.id}-${loc}`, product: p, title: 'Local content missing', detail: marketLabel(loc), tone: 'missing', tab: 'marketing', context: loc })
        else if (st === 'outdated') items.push({ key: `o-${p.id}-${loc}`, product: p, title: 'Global content changed', detail: `${marketLabel(loc)} – review against v${p.marketing.version}`, tone: 'outdated', tab: 'marketing', context: loc, at: p.marketing.meta.updatedAt })
        else if (v && variantMissingFields(v).length) items.push({ key: `i-${p.id}-${loc}`, product: p, title: 'Local content incomplete', detail: `${marketLabel(loc)} – ${variantMissingFields(v).join(', ').toLowerCase()}`, tone: 'missing', tab: 'marketing', context: loc })
      }
    }
  }
  if (can.editGlobal(user)) {
    for (const p of products) {
      const miss = completeness(p).missing.filter((c) => c.group !== 'markets')
      if (miss.length) items.push({ key: `g-${p.id}`, product: p, title: 'Global content incomplete', detail: miss.map((c) => c.label).join(', '), tone: 'missing', tab: miss[0].group === 'assets' ? 'assets' : miss[0].group === 'info' ? 'information' : 'marketing', context: 'global' })
    }
  }
  const order = { review: 0, changes: 1, outdated: 2, missing: 3 }
  return items.sort((a, b) => order[a.tone] - order[b.tone] || (b.at ?? '').localeCompare(a.at ?? ''))
}

export function label(section: Section) {
  if (section === 'info') return 'Product information'
  if (section === 'marketing') return 'Marketing content'
  return marketLabel(section)
}

export interface MarketCoverage {
  id: string
  market: string
  language: string
  region: string
  total: number
  counts: Record<VariantState, number>
  live: number
}

export function marketCoverage(products: Product[]): MarketCoverage[] {
  return MARKETS.map((m) => {
    const counts: Record<VariantState, number> = { approved: 0, in_review: 0, draft: 0, outdated: 0, missing: 0 }
    let total = 0
    let live = 0
    for (const p of products) {
      if (!p.markets.includes(m.id)) continue
      total++
      counts[variantState(p, m.id)]++
      if (p.variants[m.id]?.websiteStatus === 'live') live++
    }
    return { ...m, total, counts, live }
  })
}
