// Derived views: approval queue, personal to-do list, home page numbers, market coverage.
import type { Product, Section, Status, User } from '../types'
import { MARKETS, marketLabel } from './reference'
import { can, marketState, todos, variantGaps, type MarketState } from './rules'

export interface Block {
  product: Product
  section: Section
  status: Status
  updatedBy: string
  updatedAt: string
  reviewNote?: string
}

/** The global content and every market version of every product, as one list. */
export function allBlocks(products: Product[]): Block[] {
  const out: Block[] = []
  for (const p of products) {
    out.push({ product: p, section: 'global', ...p.status })
    for (const [loc, v] of Object.entries(p.variants)) out.push({ product: p, section: loc, ...v.meta })
  }
  return out
}

export const blockLabel = (section: Section) => (section === 'global' ? 'Global content' : marketLabel(section))

/** Link to the place where a block is edited */
export const blockHref = (productId: string, section: Section) =>
  section === 'global' ? `/products/${productId}` : `/products/${productId}/translations/${section}`

export interface WorkItem {
  key: string
  product: Product
  title: string
  detail: string
  tone: 'approve' | 'sent_back' | 'update' | 'missing' | 'draft'
  href: string
  at?: string
}

/** What the given person should do next, most urgent first. */
export function workItems(products: Product[], user: User): WorkItem[] {
  const items: WorkItem[] = []
  const mine = (loc: string) => user.markets.length === 0 || user.markets.includes(loc)
  for (const b of allBlocks(products)) {
    const local = b.section !== 'global'
    const href = blockHref(b.product.id, b.section)
    if (can.approve(user) && b.status === 'in_review' && (!local || mine(b.section))) {
      items.push({ key: `a-${b.product.id}-${b.section}`, product: b.product, title: 'Approve', detail: blockLabel(b.section), tone: 'approve', href, at: b.updatedAt })
    }
    const editable = local ? user.markets.includes(b.section) && can.editMarket(user, b.section) : can.editGlobal(user)
    if (editable && b.status === 'draft' && b.reviewNote) {
      items.push({ key: `s-${b.product.id}-${b.section}`, product: b.product, title: 'Sent back to you', detail: `${blockLabel(b.section)}: “${b.reviewNote}”`, tone: 'sent_back', href, at: b.updatedAt })
    } else if (editable && b.status === 'draft' && (local || b.product.owner === user.id)) {
      items.push({ key: `d-${b.product.id}-${b.section}`, product: b.product, title: 'Draft not sent for approval', detail: blockLabel(b.section), tone: 'draft', href, at: b.updatedAt })
    }
  }
  if (user.role === 'local_editor') {
    for (const p of products) {
      for (const loc of p.markets.filter((l) => user.markets.includes(l))) {
        const st = marketState(p, loc)
        const href = blockHref(p.id, loc)
        const v = p.variants[loc]
        if (st === 'not_started') items.push({ key: `n-${p.id}-${loc}`, product: p, title: 'Translation not started', detail: marketLabel(loc), tone: 'missing', href })
        else if (st === 'needs_update') items.push({ key: `u-${p.id}-${loc}`, product: p, title: 'English text has changed', detail: `${marketLabel(loc)}: check your translation`, tone: 'update', href, at: p.status.updatedAt })
        else if (v && variantGaps(v).length) items.push({ key: `g-${p.id}-${loc}`, product: p, title: 'Translation incomplete', detail: `${marketLabel(loc)}: add ${variantGaps(v).join(', ')}`, tone: 'missing', href })
      }
    }
  }
  if (can.editGlobal(user)) {
    for (const p of products.filter((x) => x.owner === user.id)) {
      const copy = todos(p).filter((t) => t.area === 'copy')
      if (copy.length) items.push({ key: `c-${p.id}`, product: p, title: 'Marketing copy missing', detail: copy.map((t) => t.label).join(', '), tone: 'missing', href: `/products/${p.id}` })
    }
  }
  const order = { approve: 0, sent_back: 1, update: 2, draft: 3, missing: 4 }
  return items.sort((a, b) => order[a.tone] - order[b.tone] || (b.at ?? '').localeCompare(a.at ?? ''))
}

export function homeNumbers(products: Product[]) {
  let waiting = 0
  let needsUpdate = 0
  let copyIncomplete = 0
  for (const p of products) {
    if (p.status.status === 'in_review') waiting++
    for (const loc of p.markets) {
      const st = marketState(p, loc)
      if (st === 'in_review') waiting++
      if (st === 'needs_update') needsUpdate++
    }
    if (todos(p).some((t) => t.area === 'copy')) copyIncomplete++
  }
  return { products: products.length, waiting, needsUpdate, copyIncomplete }
}

export interface MarketCoverage {
  id: string
  market: string
  language: string
  region: string
  total: number
  counts: Record<MarketState, number>
  live: number
}

export function marketCoverage(products: Product[]): MarketCoverage[] {
  return MARKETS.map((m) => {
    const counts: Record<MarketState, number> = { approved: 0, in_review: 0, draft: 0, needs_update: 0, not_started: 0 }
    let total = 0
    let live = 0
    for (const p of products) {
      if (!p.markets.includes(m.id)) continue
      total++
      counts[marketState(p, m.id)]++
      if (p.variants[m.id]?.websiteStatus === 'live') live++
    }
    return { ...m, total, counts, live }
  })
}
