// Application state + actions.
//
// For the prototype all data lives in the browser (IndexedDB), seeded from seed.json.
// Every write goes through the action functions below, so replacing this module's
// persistence with calls to a REST API later is a contained change.
import { useSyncExternalStore } from 'react'
import seed from './seed.json'
import type {
  Asset, AssetType, Database, HistoryAction, HistoryEntry, InfoField, MarketingContent, Product, Section, Status, User, Variant,
} from '../types'
import { INFO_FIELDS, MARKETING_FIELDS } from '../types'
import { idb } from '../lib/idb'
import { marketLabel } from './reference'

export interface Toast { id: number; text: string; tone: 'ok' | 'info' | 'warn' }

export interface State {
  ready: boolean
  db: Database
  userId: string
  /** Working context: 'global' or a locale id. Shared by the top bar and product pages. */
  context: string
  toasts: Toast[]
  /** Object URLs for uploaded files, keyed by asset id */
  blobUrls: Record<string, string>
}

const SEED = seed as unknown as Database

let state: State = {
  ready: false,
  db: SEED,
  userId: 'u-ingrid',
  context: 'global',
  toasts: [],
  blobUrls: {},
}

const listeners = new Set<() => void>()
function emit() { listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function getState() { return state }

/** Select a slice of state. Selectors must return existing references (no new objects). */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

/* ---------------- Persistence ---------------- */

let saveTimer: number | undefined
function setState(patch: Partial<State>, persist = true) {
  state = { ...state, ...patch }
  emit()
  if (persist) {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      idb.set('kv', 'db', state.db).catch(() => {})
      idb.set('kv', 'session', { userId: state.userId, context: state.context }).catch(() => {})
    }, 250)
  }
}

export async function init() {
  try {
    const db = await idb.get<Database>('kv', 'db')
    const session = await idb.get<{ userId: string; context: string }>('kv', 'session')
    const blobs = await idb.entries<Blob>('blobs')
    const blobUrls: Record<string, string> = {}
    for (const [k, b] of blobs) blobUrls[k] = URL.createObjectURL(b)
    state = {
      ...state,
      db: db && db.version === SEED.version ? db : SEED,
      userId: session?.userId ?? state.userId,
      context: session?.context ?? state.context,
      blobUrls,
      ready: true,
    }
  } catch {
    state = { ...state, ready: true } // storage blocked (private mode etc.) - run in memory
  }
  emit()
}

export async function resetDemo() {
  await idb.clear('kv').catch(() => {})
  await idb.clear('blobs').catch(() => {})
  Object.values(state.blobUrls).forEach((u) => URL.revokeObjectURL(u))
  setState({ db: SEED, blobUrls: {}, context: 'global' })
  toast('Demo data has been reset', 'info')
}

/* ---------------- Helpers ---------------- */

const now = () => new Date().toISOString()
let uid = 0
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(uid++).toString(36)}`

export function currentUser(s: State = state): User {
  return s.db.users.find((u) => u.id === s.userId) ?? s.db.users[0]
}
export function userName(id: string): string {
  return state.db.users.find((u) => u.id === id)?.name ?? (id === 'website' ? 'biomar.com import' : 'Website import')
}

let toastId = 0
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: ++toastId, text, tone }
  setState({ toasts: [...state.toasts, t] }, false)
  window.setTimeout(() => setState({ toasts: state.toasts.filter((x) => x.id !== t.id) }, false), 3500)
}

function updateProduct(id: string, fn: (p: Product) => Product) {
  setState({ db: { ...state.db, products: state.db.products.map((p) => (p.id === id ? fn(p) : p)) } })
}

function historyEntry(section: Section, action: HistoryAction, summary: string, snapshot?: Record<string, unknown>): HistoryEntry {
  return { id: newId('h'), at: now(), by: state.userId, section, action, summary, snapshot }
}

function pick<T extends object>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const o = obj as Record<string, unknown>
  return Object.fromEntries(keys.map((k) => [k, structuredClone(o[k])]))
}

export function sectionLabel(section: Section): string {
  if (section === 'info') return 'Product information'
  if (section === 'marketing') return 'Marketing content'
  if (section === 'assets') return 'Assets'
  return marketLabel(section)
}

/** Editing approved content puts it back to draft so changes are always reviewed. */
const afterEdit = (s: Status): Status => (s === 'approved' ? 'draft' : s)

/* ---------------- Session ---------------- */

export function setUser(userId: string) { setState({ userId }) }
export function setContext(context: string) { setState({ context }) }

/* ---------------- Product information ---------------- */

export function saveInfo(id: string, patch: Partial<Pick<Product, InfoField>>) {
  updateProduct(id, (p) => {
    const next = { ...p, ...patch }
    const changed = INFO_FIELDS.filter((k) => JSON.stringify(p[k]) !== JSON.stringify(next[k]))
    if (!changed.length) return p
    next.info = { ...p.info, status: afterEdit(p.info.status), updatedBy: state.userId, updatedAt: now() }
    next.sampleFields = p.sampleFields?.filter((f) => !(changed as readonly string[]).includes(f))
    next.history = [historyEntry('info', 'edited', `Updated ${changed.length} field${changed.length > 1 ? 's' : ''}: ${changed.join(', ')}`, pick(next, INFO_FIELDS)), ...p.history]
    return next
  })
  toast('Product information saved')
}

/* ---------------- Marketing ---------------- */

export function saveMarketing(id: string, patch: Partial<Omit<MarketingContent, 'version' | 'meta'>>) {
  updateProduct(id, (p) => {
    const m = { ...p.marketing, ...patch }
    const changed = MARKETING_FIELDS.filter((k) => JSON.stringify(p.marketing[k]) !== JSON.stringify(m[k]))
    if (!changed.length) return p
    m.meta = { ...m.meta, status: afterEdit(m.meta.status), updatedBy: state.userId, updatedAt: now() }
    return {
      ...p,
      sampleFields: p.sampleFields?.filter((f) => !(changed as readonly string[]).includes(f)),
      marketing: m,
      history: [historyEntry('marketing', 'edited', `Edited ${changed.join(', ')}`, pick(m, MARKETING_FIELDS)), ...p.history],
    }
  })
  toast('Marketing content saved as draft')
}

/* ---------------- Variants ---------------- */

export function emptyVariant(p: Product, fromGlobal: boolean, inherit = false): Variant {
  const m = p.marketing
  return {
    localName: '',
    shortDescription: fromGlobal ? m.shortDescription : '',
    tagline: fromGlobal ? m.tagline : '',
    description: fromGlobal ? m.description : '',
    keyBenefits: fromGlobal ? [...m.keyBenefits] : [],
    sellingPoints: fromGlobal ? [...m.sellingPoints] : [],
    notes: inherit ? 'Uses global English copy.' : '',
    inheritsGlobal: inherit,
    websiteStatus: 'not_live',
    sourceVersion: m.version,
    meta: { status: 'draft', updatedBy: state.userId, updatedAt: now() },
  }
}

export function createVariant(id: string, locale: string, mode: 'copy' | 'empty' | 'inherit') {
  updateProduct(id, (p) => ({
    ...p,
    markets: p.markets.includes(locale) ? p.markets : [...p.markets, locale],
    variants: { ...p.variants, [locale]: emptyVariant(p, mode === 'copy', mode === 'inherit') },
    history: [historyEntry(locale, 'variant_created', `${marketLabel(locale)} variant created${mode === 'copy' ? ' from global copy' : mode === 'inherit' ? ' (uses global copy)' : ''}`), ...p.history],
  }))
  toast(`${marketLabel(locale)} variant created`)
}

const VARIANT_FIELDS = ['localName', 'tagline', 'shortDescription', 'description', 'keyBenefits', 'sellingPoints', 'notes', 'inheritsGlobal'] as const

export function saveVariant(id: string, locale: string, patch: Partial<Variant>, quiet = false) {
  updateProduct(id, (p) => {
    const old = p.variants[locale]
    if (!old) return p
    const v = { ...old, ...patch }
    const contentChanged = VARIANT_FIELDS.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(v[k]))
    if (contentChanged.length) {
      v.meta = { ...v.meta, status: afterEdit(v.meta.status), updatedBy: state.userId, updatedAt: now() }
      v.sourceVersion = p.marketing.version // editor has worked against the current global copy
    }
    const summary = contentChanged.length
      ? `Edited ${contentChanged.join(', ')}`
      : patch.websiteStatus ? `Website status set to ${patch.websiteStatus === 'live' ? 'live' : 'not live'}` : 'Updated'
    return {
      ...p,
      variants: { ...p.variants, [locale]: v },
      history: [historyEntry(locale, 'edited', summary, contentChanged.length ? pick(v, VARIANT_FIELDS) : undefined), ...p.history],
    }
  })
  if (!quiet) toast('Local content saved')
}

export function markVariantUpToDate(id: string, locale: string) {
  updateProduct(id, (p) => {
    const v = p.variants[locale]
    if (!v) return p
    return {
      ...p,
      variants: { ...p.variants, [locale]: { ...v, sourceVersion: p.marketing.version, meta: { ...v.meta, updatedBy: state.userId, updatedAt: now() } } },
      history: [historyEntry(locale, 'edited', `Checked against global v${p.marketing.version} – no local changes needed`), ...p.history],
    }
  })
  toast('Marked as up to date with global content')
}

export function setMarkets(id: string, add?: string, remove?: string) {
  updateProduct(id, (p) => {
    let markets = p.markets
    const h: HistoryEntry[] = []
    if (add && !markets.includes(add)) { markets = [...markets, add]; h.push(historyEntry(add, 'market_added', `Added ${marketLabel(add)} as a target market`)) }
    if (remove) { markets = markets.filter((m) => m !== remove); h.push(historyEntry(remove, 'market_removed', `Removed ${marketLabel(remove)} as a target market`)) }
    return { ...p, markets, history: [...h, ...p.history] }
  })
}

/* ---------------- Workflow ---------------- */

function getMeta(p: Product, section: Section) {
  if (section === 'info') return p.info
  if (section === 'marketing') return p.marketing.meta
  return p.variants[section]?.meta
}

export function transition(id: string, section: Section, to: Status, note?: string) {
  updateProduct(id, (p) => {
    const meta = getMeta(p, section)
    if (!meta) return p
    const newMeta = { ...meta, status: to, updatedBy: state.userId, updatedAt: now(), reviewNote: to === 'draft' ? note : undefined }
    const action: HistoryAction = to === 'approved' ? 'approved' : to === 'in_review' ? 'submitted' : 'changes_requested'
    let next: Product = { ...p }
    let summary = `${sectionLabel(section)} ${to === 'approved' ? 'approved' : to === 'in_review' ? 'submitted for review' : 'sent back with requested changes'}`
    if (note) summary += ` – “${note}”`
    let snapshot: Record<string, unknown> | undefined
    if (section === 'info') { next.info = newMeta; snapshot = pick(p, INFO_FIELDS) }
    else if (section === 'marketing') {
      const version = to === 'approved' ? p.marketing.version + 1 : p.marketing.version
      next.marketing = { ...p.marketing, meta: newMeta, version }
      if (to === 'approved') summary = `Marketing content approved as v${version}`
      snapshot = pick(next.marketing, MARKETING_FIELDS)
    } else {
      const v = p.variants[section]
      next.variants = { ...p.variants, [section]: { ...v, meta: newMeta } }
      snapshot = pick(v, VARIANT_FIELDS)
    }
    next.history = [historyEntry(section, action, summary, to === 'approved' ? snapshot : undefined), ...p.history]
    return next
  })
  toast(to === 'approved' ? `${sectionLabel(section)} approved` : to === 'in_review' ? 'Submitted for review' : 'Changes requested', to === 'draft' ? 'info' : 'ok')
}


/* ---------------- History ---------------- */

export function restoreVersion(id: string, entryId: string) {
  updateProduct(id, (p) => {
    const e = p.history.find((h) => h.id === entryId)
    if (!e?.snapshot) return p
    const snap = structuredClone(e.snapshot)
    const next: Product = { ...p }
    if (e.section === 'info') {
      Object.assign(next, snap)
      next.info = { ...p.info, status: 'draft', updatedBy: state.userId, updatedAt: now() }
    } else if (e.section === 'marketing') {
      next.marketing = { ...p.marketing, ...snap, meta: { ...p.marketing.meta, status: 'draft', updatedBy: state.userId, updatedAt: now() } }
    } else if (p.variants[e.section]) {
      const v = p.variants[e.section]
      next.variants = { ...p.variants, [e.section]: { ...v, ...snap, meta: { ...v.meta, status: 'draft', updatedBy: state.userId, updatedAt: now() } } }
    }
    next.history = [historyEntry(e.section, 'restored', `Restored ${sectionLabel(e.section).toLowerCase()} from ${new Date(e.at).toLocaleDateString('en-GB')}`, snap), ...p.history]
    return next
  })
  toast('Previous version restored as a draft')
}

/* ---------------- Assets ---------------- */

export async function addAsset(id: string, file: File, type: AssetType, scope: string) {
  const asset: Asset = {
    id: newId('a'),
    type,
    fileName: file.name,
    mime: file.type || 'application/octet-stream',
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    scope,
    source: 'upload',
    uploadedBy: state.userId,
    uploadedAt: now(),
  }
  await idb.set('blobs', asset.id, file).catch(() => {})
  setState({ blobUrls: { ...state.blobUrls, [asset.id]: URL.createObjectURL(file) } }, false)
  updateProduct(id, (p) => ({
    ...p,
    assets: [asset, ...p.assets],
    history: [historyEntry('assets', 'asset_added', `Uploaded ${file.name} (${type}${scope !== 'global' ? `, ${marketLabel(scope, true)}` : ''})`), ...p.history],
  }))
  toast(`${file.name} uploaded`)
}

export function removeAsset(id: string, assetId: string) {
  updateProduct(id, (p) => {
    const a = p.assets.find((x) => x.id === assetId)
    return {
      ...p,
      assets: p.assets.filter((x) => x.id !== assetId),
      history: [historyEntry('assets', 'asset_removed', `Removed ${a?.fileName ?? 'asset'}`), ...p.history],
    }
  })
  idb.del('blobs', assetId).catch(() => {})
  toast('Asset removed', 'info')
}

/* ---------------- Products ---------------- */

export function createProduct(input: { name: string; species: string; range: string; category: string; stages: string[] }): string {
  const slugBase = `${input.name}-${input.species}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let slug = slugBase
  let i = 2
  while (state.db.products.some((p) => p.id === slug)) slug = `${slugBase}-${i++}`
  const t = now()
  const meta = { status: 'draft' as Status, updatedBy: state.userId, updatedAt: t }
  const p: Product = {
    id: slug,
    code: 'BM-' + input.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + input.species.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
    name: input.name,
    species: input.species,
    range: input.range,
    category: input.category,
    stages: input.stages,
    feedType: 'Extruded pellet',
    pelletSizes: [],
    packaging: [],
    regulatoryNotes: '',
    owner: state.userId,
    lifecycle: 'active',
    info: meta,
    marketing: { shortDescription: '', tagline: '', description: '', keyBenefits: [], sellingPoints: [], version: 0, meta: { ...meta } },
    markets: [],
    variants: {},
    assets: [],
    history: [historyEntry('info', 'created', 'Product record created')],
    createdAt: t,
  }
  setState({ db: { ...state.db, products: [p, ...state.db.products] } })
  toast(`${input.name} – ${input.species} created`)
  return slug
}

/* ---------------- Users ---------------- */

export function updateUser(id: string, patch: Partial<User>) {
  setState({ db: { ...state.db, users: state.db.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) } })
}
