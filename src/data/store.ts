// Application state and actions.
//
// For the prototype all data lives in the browser (IndexedDB), seeded from seed.json.
// Every write goes through the functions below, so moving to a server later only
// means replacing the persistence in this file.
import { useSyncExternalStore } from 'react'
import seed from './seed.json'
import type {
  Asset, AssetType, Copy, Database, DetailField, HistoryAction, HistoryEntry, Product, Section, Status, User, Variant,
} from '../types'
import { COPY_FIELDS, DETAIL_FIELDS } from '../types'
import { idb } from '../lib/idb'
import { ASSET_LABEL, marketLabel } from './reference'

export interface Toast { id: number; text: string; tone: 'ok' | 'info' }

export interface State {
  ready: boolean
  db: Database
  userId: string
  toasts: Toast[]
  /** Object URLs for uploaded files, keyed by asset id */
  blobUrls: Record<string, string>
}

const SEED = seed as unknown as Database

let state: State = { ready: false, db: SEED, userId: 'u-ingrid', toasts: [], blobUrls: {} }

const listeners = new Set<() => void>()
function emit() { listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

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
      idb.set('kv', 'session', { userId: state.userId }).catch(() => {})
    }, 250)
  }
}

export async function init() {
  try {
    const db = await idb.get<Database>('kv', 'db')
    const session = await idb.get<{ userId: string }>('kv', 'session')
    const blobs = await idb.entries<Blob>('blobs')
    const blobUrls: Record<string, string> = {}
    for (const [k, b] of blobs) blobUrls[k] = URL.createObjectURL(b)
    state = {
      ...state,
      db: db && db.version === SEED.version ? db : SEED,
      userId: session?.userId ?? state.userId,
      blobUrls,
      ready: true,
    }
  } catch {
    state = { ...state, ready: true } // storage blocked (private window etc.): run in memory
  }
  emit()
}

export async function resetDemo() {
  await idb.clear('kv').catch(() => {})
  await idb.clear('blobs').catch(() => {})
  Object.values(state.blobUrls).forEach((u) => URL.revokeObjectURL(u))
  setState({ db: SEED, blobUrls: {} })
  toast('Demo data reset', 'info')
}

/* ---------------- Helpers ---------------- */

const now = () => new Date().toISOString()
let uid = 0
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(uid++).toString(36)}`

export function currentUser(s: State = state): User {
  return s.db.users.find((u) => u.id === s.userId) ?? s.db.users[0]
}
export function userName(id: string): string {
  return state.db.users.find((u) => u.id === id)?.name ?? (id === 'website' ? 'biomar.com' : 'Website import')
}

let toastId = 0
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: ++toastId, text, tone }
  setState({ toasts: [...state.toasts, t] }, false)
  window.setTimeout(() => setState({ toasts: state.toasts.filter((x) => x.id !== t.id) }, false), 3200)
}

function updateProduct(id: string, fn: (p: Product) => Product) {
  setState({ db: { ...state.db, products: state.db.products.map((p) => (p.id === id ? fn(p) : p)) } })
}

function historyEntry(section: Section, action: HistoryAction, summary: string, snapshot?: Record<string, unknown>): HistoryEntry {
  return { id: newId('h'), at: now(), by: state.userId, section, action, summary, snapshot }
}

function pick(obj: object, keys: readonly string[]): Record<string, unknown> {
  const o = obj as Record<string, unknown>
  return Object.fromEntries(keys.map((k) => [k, structuredClone(o[k])]))
}

const FIELD_NAMES: Record<string, string> = {
  name: 'name', species: 'species', range: 'range', categories: 'category', stages: 'stage', code: 'product code',
  feedType: 'feed type', pelletSizes: 'pellet sizes', packaging: 'packaging', owner: 'owner', lifecycle: 'lifecycle',
  notes: 'notes', tagline: 'tagline', shortDescription: 'short description', description: 'description',
  keyBenefits: 'key benefits', sellingPoints: 'selling points', localName: 'local name', inheritsGlobal: 'language setting',
}
const listFields = (keys: readonly string[]) => keys.map((k) => FIELD_NAMES[k] ?? k).join(', ')

export function sectionLabel(section: Section): string {
  if (section === 'global') return 'Global content'
  if (section === 'assets') return 'Files'
  return marketLabel(section)
}

/** Editing approved content turns it into a new draft, so changes always get approved. */
const afterEdit = (s: Status): Status => (s === 'approved' ? 'draft' : s)

export function setUser(userId: string) { setState({ userId }) }

/* ---------------- Global content ---------------- */

const GLOBAL_FIELDS = [...DETAIL_FIELDS, ...COPY_FIELDS] as const

export function saveGlobal(id: string, patch: Partial<Pick<Product, DetailField>> & Partial<Copy>) {
  let changedCount = 0
  updateProduct(id, (p) => {
    const before = { ...p, ...p.content } as Record<string, unknown>
    const after = { ...before, ...patch }
    const changed = GLOBAL_FIELDS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    changedCount = changed.length
    if (!changed.length) return p
    const next: Product = { ...p }
    for (const k of changed) {
      if ((COPY_FIELDS as readonly string[]).includes(k)) next.content = { ...next.content, [k]: after[k] }
      else Object.assign(next, { [k]: after[k] })
    }
    next.status = { ...p.status, status: afterEdit(p.status.status), updatedBy: state.userId, updatedAt: now() }
    next.history = [historyEntry('global', 'edited', `Changed ${listFields(changed)}`, { ...pick(next, DETAIL_FIELDS), ...pick(next.content, COPY_FIELDS) }), ...p.history]
    return next
  })
  if (changedCount) toast('Saved as draft')
}

/* ---------------- Market versions ---------------- */

export function createVariant(id: string, locale: string, mode: 'copy' | 'empty' | 'inherit') {
  updateProduct(id, (p) => {
    const c = p.content
    const fromGlobal = mode === 'copy'
    const v: Variant = {
      localName: '',
      tagline: fromGlobal ? c.tagline : '',
      shortDescription: fromGlobal ? c.shortDescription : '',
      description: fromGlobal ? c.description : '',
      keyBenefits: fromGlobal ? [...c.keyBenefits] : [],
      sellingPoints: fromGlobal ? [...c.sellingPoints] : [],
      notes: '',
      inheritsGlobal: mode === 'inherit',
      websiteStatus: 'not_live',
      sourceVersion: c.version,
      meta: { status: 'draft', updatedBy: state.userId, updatedAt: now() },
    }
    return {
      ...p,
      markets: p.markets.includes(locale) ? p.markets : [...p.markets, locale],
      variants: { ...p.variants, [locale]: v },
      history: [historyEntry(locale, 'variant_created', mode === 'inherit' ? 'Set to use the English text' : mode === 'copy' ? 'Translation started from the English text' : 'Translation started'), ...p.history],
    }
  })
  toast(`${marketLabel(locale)} started`)
}

const VARIANT_FIELDS = ['localName', ...COPY_FIELDS, 'notes', 'inheritsGlobal'] as const

export function saveVariant(id: string, locale: string, patch: Partial<Variant>, quiet = false) {
  updateProduct(id, (p) => {
    const old = p.variants[locale]
    if (!old) return p
    const v = { ...old, ...patch }
    const changed = VARIANT_FIELDS.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(v[k]))
    if (changed.length) {
      v.meta = { ...v.meta, status: afterEdit(v.meta.status), updatedBy: state.userId, updatedAt: now() }
      v.sourceVersion = p.content.version // the editor has worked against the current English text
    }
    const summary = changed.length
      ? `Changed ${listFields(changed)}`
      : patch.websiteStatus ? `Marked as ${patch.websiteStatus === 'live' ? 'live' : 'not live'} on the website` : 'Updated'
    return {
      ...p,
      variants: { ...p.variants, [locale]: v },
      history: [historyEntry(locale, 'edited', summary, changed.length ? pick(v, VARIANT_FIELDS) : undefined), ...p.history],
    }
  })
  if (!quiet) toast('Saved as draft')
}

export function markVariantUpToDate(id: string, locale: string) {
  updateProduct(id, (p) => {
    const v = p.variants[locale]
    if (!v) return p
    return {
      ...p,
      variants: { ...p.variants, [locale]: { ...v, sourceVersion: p.content.version, meta: { ...v.meta, updatedBy: state.userId, updatedAt: now() } } },
      history: [historyEntry(locale, 'edited', `Checked against global version ${p.content.version}, no change needed`), ...p.history],
    }
  })
  toast('Marked as up to date')
}

export function setMarkets(id: string, add?: string, remove?: string) {
  updateProduct(id, (p) => {
    let markets = p.markets
    const h: HistoryEntry[] = []
    if (add && !markets.includes(add)) { markets = [...markets, add]; h.push(historyEntry(add, 'market_added', `Added ${marketLabel(add)}`)) }
    if (remove) { markets = markets.filter((m) => m !== remove); h.push(historyEntry(remove, 'market_removed', `Removed ${marketLabel(remove)}`)) }
    return { ...p, markets, history: [...h, ...p.history] }
  })
  if (add) toast(`${marketLabel(add)} added`)
  if (remove) toast(`${marketLabel(remove)} removed`, 'info')
}

/* ---------------- Approval ---------------- */

export function transition(id: string, section: Section, to: Status, note?: string) {
  updateProduct(id, (p) => {
    const meta = section === 'global' ? p.status : p.variants[section]?.meta
    if (!meta) return p
    const newMeta = { ...meta, status: to, updatedBy: state.userId, updatedAt: now(), reviewNote: to === 'draft' ? note : undefined }
    const action: HistoryAction = to === 'approved' ? 'approved' : to === 'in_review' ? 'submitted' : 'changes_requested'
    const next: Product = { ...p }
    let summary = to === 'approved' ? 'Approved' : to === 'in_review' ? 'Sent for approval' : `Sent back: “${note}”`
    let snapshot: Record<string, unknown> | undefined
    if (section === 'global') {
      next.status = newMeta
      if (to === 'approved') {
        next.content = { ...p.content, version: p.content.version + 1 }
        summary = `Approved as version ${next.content.version}`
      }
      snapshot = { ...pick(p, DETAIL_FIELDS), ...pick(p.content, COPY_FIELDS) }
    } else {
      const v = p.variants[section]
      next.variants = { ...p.variants, [section]: { ...v, meta: newMeta } }
      snapshot = pick(v, VARIANT_FIELDS)
    }
    next.history = [historyEntry(section, action, summary, to === 'approved' ? snapshot : undefined), ...p.history]
    return next
  })
  toast(to === 'approved' ? 'Approved' : to === 'in_review' ? 'Sent for approval' : 'Sent back to the editor', to === 'draft' ? 'info' : 'ok')
}

/* ---------------- History ---------------- */

export function restoreVersion(id: string, entryId: string) {
  updateProduct(id, (p) => {
    const e = p.history.find((h) => h.id === entryId)
    if (!e?.snapshot) return p
    const snap = structuredClone(e.snapshot) as Record<string, unknown>
    const next: Product = { ...p }
    if (e.section === 'global') {
      for (const k of DETAIL_FIELDS) if (k in snap) Object.assign(next, { [k]: snap[k] })
      next.content = { ...p.content, ...pick(snap, COPY_FIELDS.filter((k) => k in snap)) }
      next.status = { ...p.status, status: 'draft', updatedBy: state.userId, updatedAt: now() }
    } else if (p.variants[e.section]) {
      const v = p.variants[e.section]
      next.variants = { ...p.variants, [e.section]: { ...v, ...snap, meta: { ...v.meta, status: 'draft', updatedBy: state.userId, updatedAt: now() } } }
    }
    next.history = [historyEntry(e.section, 'restored', `Restored the version from ${new Date(e.at).toLocaleDateString('en-GB')}`, snap), ...p.history]
    return next
  })
  toast('Earlier version restored as a draft')
}

/* ---------------- Files ---------------- */

export async function addAsset(id: string, file: File, type: AssetType, scope: string) {
  const asset: Asset = {
    id: newId('a'), type, fileName: file.name, mime: file.type || 'application/octet-stream',
    sizeKb: Math.max(1, Math.round(file.size / 1024)), scope, source: 'upload', uploadedBy: state.userId, uploadedAt: now(),
  }
  await idb.set('blobs', asset.id, file).catch(() => {})
  setState({ blobUrls: { ...state.blobUrls, [asset.id]: URL.createObjectURL(file) } }, false)
  updateProduct(id, (p) => ({
    ...p,
    assets: [asset, ...p.assets],
    history: [historyEntry('assets', 'asset_added', `Added ${file.name} (${ASSET_LABEL[type]}${scope !== 'global' ? `, ${marketLabel(scope, true)}` : ''})`), ...p.history],
  }))
  toast(`${file.name} added`)
}

export function removeAsset(id: string, assetId: string) {
  updateProduct(id, (p) => {
    const a = p.assets.find((x) => x.id === assetId)
    return {
      ...p,
      assets: p.assets.filter((x) => x.id !== assetId),
      history: [historyEntry('assets', 'asset_removed', `Deleted ${a?.fileName ?? 'a file'}`), ...p.history],
    }
  })
  idb.del('blobs', assetId).catch(() => {})
  toast('File deleted', 'info')
}

/* ---------------- Products ---------------- */

export function createProduct(input: { name: string; species: string; range: string; categories: string[]; stages: string[] }): string {
  const slugBase = `${input.name}-${input.species}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let slug = slugBase
  let i = 2
  while (state.db.products.some((p) => p.id === slug)) slug = `${slugBase}-${i++}`
  const t = now()
  const p: Product = {
    id: slug, name: input.name, species: input.species, range: input.range, categories: input.categories, stages: input.stages,
    code: '', feedType: '', pelletSizes: [], packaging: [], notes: '', owner: state.userId, lifecycle: 'active',
    status: { status: 'draft', updatedBy: state.userId, updatedAt: t },
    content: { tagline: '', shortDescription: '', description: '', keyBenefits: [], sellingPoints: [], version: 0 },
    markets: [], variants: {}, assets: [],
    history: [historyEntry('global', 'created', 'Product created')],
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
