// Application state and actions.
//
// Data is shared: in the published PIM every change is written to the shared database
// (see lib/shared.ts) and everyone sees it live. Outside claude.ai it falls back to this browser.
// Every write goes through the functions below, so moving to a real backend only means
// replacing lib/shared.ts.
import { useSyncExternalStore } from 'react'
import seed from './seed.json'
import type {
  AssetRef, Copy, TagKind, TagRequest, Database, DetailField, HistoryAction, HistoryEntry, InternalInfo, InternalNote, LocalCopy, MarketInfo, Product, Section, Status, User, Variant, VersionText,
} from '../types'
import { COPY_FIELDS, DETAIL_FIELDS, LOCAL_FIELDS } from '../types'
import { idb } from '../lib/idb'
import * as shared from '../lib/shared'
import { removeFile } from '../lib/uploads'
import { ASSET_LABEL, GLOBAL, marketLabel } from './reference'
import { can } from './rules'

export interface Toast { id: number; text: string; tone: 'ok' | 'info' | 'error' }

export interface State {
  ready: boolean
  db: Database
  userId: string
  /** Selected locale: "global" or a locale id */
  locale: string
  /** 'shared' = everyone sees the same data; 'local' = this browser only */
  storage: 'shared' | 'local'
  saving: boolean
  toasts: Toast[]
  /** Open "Tag someone" dialog */
  tagging: TagDraft | null
}

export interface TagDraft { productId: string; locale: string; about?: string; kind?: TagKind }

const SEED = seed as unknown as Database

let state: State = { ready: false, db: SEED, userId: 'u-cathrine', locale: 'da-DK', storage: 'local', saving: false, toasts: [], tagging: null }

const listeners = new Set<() => void>()
function emit() { listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

/** Select a slice of state. Selectors must return existing references (no new objects). */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  emit()
}

/* ---------------- Session (per viewer) ---------------- */

const SESSION_KEY = 'pim.session'
function saveSession() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: state.userId, locale: state.locale })) } catch { /* storage blocked */ }
}
function loadSession(): { userId?: string; locale?: string } {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') } catch { return {} }
}

/* ---------------- Loading and persistence ---------------- */

let sharedProducts = new Map<string, Product>()
let sharedUsers = new Map<string, User>()

function mergeShared() {
  const products = SEED.products.map((p) => sharedProducts.get(p.id) ?? p)
  const seedIds = new Set(SEED.products.map((p) => p.id))
  const created = [...sharedProducts.values()].filter((p) => !seedIds.has(p.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const users = SEED.users.map((u) => sharedUsers.get(u.id) ?? u)
  set({ db: { ...state.db, products: [...created, ...products], users } })
}

export async function init() {
  const session = loadSession()
  const sharedOk = await shared.connect(SEED.version)
  let db = SEED
  if (sharedOk) {
    shared.setWriteHandlers((m) => toast(m, 'error'), () => set({ saving: false }))
    // Wait briefly for the first shared snapshot so people do not see the seed data flash first
    await new Promise<void>((resolve) => {
      let first = true
      const done = () => { if (first) { first = false; resolve() } }
      shared.listen({
        products: (m) => { sharedProducts = m; if (state.ready) mergeShared(); done() },
        users: (m) => { sharedUsers = m; if (state.ready) mergeShared() },
        error: (m) => { toast(m, 'error'); done() },
      })
      setTimeout(done, 8000)
    })
    const seedIds = new Set(SEED.products.map((p) => p.id))
    db = {
      ...SEED,
      products: [...[...sharedProducts.values()].filter((p) => !seedIds.has(p.id)), ...SEED.products.map((p) => sharedProducts.get(p.id) ?? p)],
      users: SEED.users.map((u) => sharedUsers.get(u.id) ?? u),
    }
  } else {
    try {
      const saved = await idb.get<Database>('kv', 'db')
      if (saved && saved.version === SEED.version) db = saved
    } catch { /* storage blocked: run in memory */ }
  }
  const user = db.users.find((u) => u.id === session.userId) ?? db.users.find((u) => u.id === state.userId) ?? db.users[0]
  const locale = session.locale && can.viewLocale(user, session.locale) ? session.locale : user.defaultLocale
  state = { ...state, db, userId: user.id, locale, storage: sharedOk ? 'shared' : 'local', ready: true }
  emit()
}

let localTimer: number | undefined
function persistLocal() {
  window.clearTimeout(localTimer)
  localTimer = window.setTimeout(() => idb.set('kv', 'db', state.db).catch(() => {}), 300)
}

function commitProducts(products: Product[], changed: Product[]) {
  set({ db: { ...state.db, products } })
  if (state.storage === 'shared') {
    changed.forEach((p) => { sharedProducts.set(p.id, p); shared.writeProduct(p) })
    if (changed.length) set({ saving: true })
  } else persistLocal()
}

function updateProduct(id: string, fn: (p: Product) => Product): Product | undefined {
  const p = state.db.products.find((x) => x.id === id)
  if (!p) return
  const next = fn(p)
  if (next === p) return p
  commitProducts(state.db.products.map((x) => (x.id === id ? next : x)), [next])
  return next
}

export async function resetDemo() {
  if (state.storage === 'shared') {
    sharedProducts = new Map()
    sharedUsers = new Map()
    await shared.resetShared()
  } else await idb.clear('kv').catch(() => {})
  set({ db: SEED })
  toast('Sample data reset for everyone', 'info')
}

/* ---------------- Helpers ---------------- */

const now = () => new Date().toISOString()
let uid = 0
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(uid++).toString(36)}`

export function currentUser(s: State = state): User {
  return s.db.users.find((u) => u.id === s.userId) ?? s.db.users[0]
}
export function userName(id: string): string {
  return state.db.users.find((u) => u.id === id)?.name ?? (id === 'website' ? 'Website import' : 'Former user')
}

let toastId = 0
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: ++toastId, text, tone }
  set({ toasts: [...state.toasts, t] })
  window.setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), tone === 'error' ? 6000 : 3200)
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
  keyBenefits: 'key benefits', sellingPoints: 'selling points', inheritsGlobal: 'language setting',
}
const listFields = (keys: readonly string[]) => keys.map((k) => FIELD_NAMES[k] ?? k).join(', ')

export function sectionLabel(section: Section): string {
  if (section === GLOBAL) return 'Global record'
  if (section === 'assets') return 'Assets'
  return marketLabel(section)
}

/** Editing approved content turns it into a new draft that needs approval, unless it is a small update. */
const afterEdit = (s: Status): Status => (s === 'approved' ? 'draft' : s)

/* ---------------- Session actions ---------------- */

export function setUser(userId: string) {
  const u = state.db.users.find((x) => x.id === userId)
  if (!u) return
  set({ userId, locale: u.defaultLocale })
  saveSession()
}

export function setLocale(locale: string) {
  set({ locale })
  saveSession()
}

/* ---------------- Global record ---------------- */

const GLOBAL_FIELDS = [...DETAIL_FIELDS, ...COPY_FIELDS] as const
export type GlobalPatch = Partial<Pick<Product, DetailField>> & Partial<Copy>
export interface SaveOptions {
  /** Small update (typo, wording): stays approved, no approval and no review for the locales */
  minor?: boolean
  /** Added to the history summary, e.g. " (Excel import)" */
  how?: string
}

const snapshotGlobal = (p: Product) => ({ ...pick(p, DETAIL_FIELDS), ...pick(p.content, COPY_FIELDS) })

/** Apply a change to one product. Returns the product unchanged when nothing changed. */
function applyGlobal(p: Product, patch: GlobalPatch, opt: SaveOptions = {}): Product {
  const before = { ...p, ...p.content } as Record<string, unknown>
  const after = { ...before, ...patch }
  const changed = GLOBAL_FIELDS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (!changed.length) return p
  const next: Product = { ...p }
  for (const k of changed) {
    if ((COPY_FIELDS as readonly string[]).includes(k)) next.content = { ...next.content, [k]: after[k] }
    else Object.assign(next, { [k]: after[k] })
  }
  const minor = opt.minor && p.status.status === 'approved'
  next.status = { ...p.status, status: minor ? 'approved' : afterEdit(p.status.status), updatedBy: state.userId, updatedAt: now(), reviewNote: undefined }
  if (minor) {
    // The approved version itself is corrected; the locales are not asked to review it
    next.versions = { ...p.versions, [p.content.version]: snapshotGlobal(next) as unknown as VersionText }
  }
  next.history = [historyEntry(GLOBAL, minor ? 'minor_update' : 'edited', `${minor ? 'Small update to' : 'Changed'} ${listFields(changed)}${opt.how ?? ''}`, snapshotGlobal(next)), ...p.history]
  return next
}

export function saveGlobal(id: string, patch: GlobalPatch, opt: SaveOptions = {}) {
  const p = state.db.products.find((x) => x.id === id)
  if (!p) return
  const next = applyGlobal(p, patch, opt)
  if (next === p) return toast('Nothing changed', 'info')
  updateProduct(id, () => next)
  toast(opt.minor ? 'Small update saved. Still approved.' : next.status.status === 'draft' ? 'Saved as draft' : 'Saved')
}

/** Save changes to many products at once (spreadsheet bulk edit, Excel import). Returns how many products changed. */
export function saveGlobalMany(changes: { id: string; patch: GlobalPatch }[], how: string): number {
  const byId = new Map(changes.map((c) => [c.id, c.patch]))
  const changed: Product[] = []
  const products = state.db.products.map((p) => {
    const patch = byId.get(p.id)
    if (!patch) return p
    const next = applyGlobal(p, patch, { how })
    if (next !== p) changed.push(next)
    return next
  })
  commitProducts(products, changed)
  const n = changed.length
  toast(n ? `${n} ${n === 1 ? 'product' : 'products'} updated` : 'Nothing changed', n ? 'ok' : 'info')
  return n
}

/* ---------------- Local versions ---------------- */

const emptyLocal = (): LocalCopy => ({ shortDescription: '', description: '', keyBenefits: [], sellingPoints: [] })

export function createVariant(id: string, locale: string, mode: 'copy' | 'empty' | 'inherit') {
  updateProduct(id, (p) => {
    const c = p.content
    const v: Variant = {
      ...(mode === 'copy' ? { shortDescription: c.shortDescription, description: c.description, keyBenefits: [...c.keyBenefits], sellingPoints: [...c.sellingPoints] } : emptyLocal()),
      notes: '',
      inheritsGlobal: mode === 'inherit',
      websiteStatus: 'not_live',
      sourceVersion: c.version,
      version: 0,
      meta: { status: 'draft', updatedBy: state.userId, updatedAt: now() },
    }
    return {
      ...p,
      markets: p.markets.includes(locale) ? p.markets : [...p.markets, locale],
      variants: { ...p.variants, [locale]: v },
      history: [historyEntry(locale, 'variant_created', mode === 'inherit' ? 'Set to use the global English text' : mode === 'copy' ? 'Local version started from the English text' : 'Local version started'), ...p.history],
    }
  })
  toast(`${marketLabel(locale)} version started`)
}

const VARIANT_FIELDS = [...LOCAL_FIELDS, 'notes', 'inheritsGlobal'] as const

export function saveVariant(id: string, locale: string, patch: Partial<Variant>, opt: SaveOptions = {}) {
  let minorDone = false
  let changedAny = false
  updateProduct(id, (p) => {
    const old = p.variants[locale]
    if (!old) return p
    const v: Variant = { ...old, ...patch }
    const changed = VARIANT_FIELDS.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(v[k]))
    if (!changed.length) return p
    changedAny = true
    const minor = !!opt.minor && old.meta.status === 'approved'
    minorDone = minor
    v.meta = { ...v.meta, status: minor ? 'approved' : afterEdit(v.meta.status), updatedBy: state.userId, updatedAt: now(), reviewNote: undefined }
    if (minor) v.approved = pick(v, LOCAL_FIELDS) as unknown as LocalCopy
    v.sourceVersion = p.content.version // written against the current global version
    return {
      ...p,
      variants: { ...p.variants, [locale]: v },
      history: [historyEntry(locale, minor ? 'minor_update' : 'edited', `${minor ? 'Small update to' : 'Changed'} ${listFields(changed)}`, pick(v, VARIANT_FIELDS)), ...p.history],
    }
  })
  if (!changedAny) return toast('Nothing changed', 'info')
  toast(minorDone ? 'Small update saved. Still approved.' : 'Saved as draft')
}

/** The local copy was checked against the latest global version and needs no change. */
export function markReviewed(id: string, locale: string) {
  updateProduct(id, (p) => {
    const v = p.variants[locale]
    if (!v) return p
    return {
      ...p,
      variants: { ...p.variants, [locale]: { ...v, sourceVersion: p.content.version, meta: { ...v.meta, updatedBy: state.userId, updatedAt: now() } } },
      history: [historyEntry(locale, 'reviewed', `Checked against global version ${p.content.version}, no change needed`), ...p.history],
    }
  })
  toast('Marked as reviewed')
}

export function setWebsiteStatus(id: string, locale: string, live: boolean) {
  updateProduct(id, (p) => {
    const v = p.variants[locale]
    if (!v) return p
    return {
      ...p,
      variants: { ...p.variants, [locale]: { ...v, websiteStatus: live ? 'live' : 'not_live' } },
      history: [historyEntry(locale, 'edited', `Marked as ${live ? 'live' : 'not live'} on the website`), ...p.history],
    }
  })
}

/** Make a product available in a locale, or remove it. Local content is kept when a locale is removed. */
export function setAvailability(id: string, locale: string, available: boolean) {
  updateProduct(id, (p) => {
    if (available === p.markets.includes(locale)) return p
    return {
      ...p,
      markets: available ? [...p.markets, locale] : p.markets.filter((m) => m !== locale),
      history: [historyEntry(locale, available ? 'market_added' : 'market_removed', available ? `Made available in ${marketLabel(locale)}` : `Removed from ${marketLabel(locale)}`), ...p.history],
    }
  })
  toast(available ? `Now available in ${marketLabel(locale)}` : `Removed from ${marketLabel(locale)}`, available ? 'ok' : 'info')
}

/* ---------------- Approval ---------------- */

export function transition(id: string, section: Section, to: Status, note?: string) {
  updateProduct(id, (p) => transitioned(p, section, to, note))
  toast(to === 'approved' ? 'Approved' : to === 'in_review' ? 'Sent for approval' : 'Sent back to the editor', to === 'draft' ? 'info' : 'ok')
}

function transitioned(p: Product, section: Section, to: Status, note?: string): Product {
  {
    const meta = section === GLOBAL ? p.status : p.variants[section]?.meta
    if (!meta) return p
    const newMeta: Variant['meta'] = { ...meta, status: to, updatedBy: state.userId, updatedAt: now(), reviewNote: to === 'draft' ? note : undefined }
    const action: HistoryAction = to === 'approved' ? 'approved' : to === 'in_review' ? 'submitted' : 'changes_requested'
    const next: Product = { ...p }
    let summary = to === 'approved' ? 'Approved' : to === 'in_review' ? 'Sent for approval' : `Sent back: “${note}”`
    let snapshot: Record<string, unknown> | undefined
    if (section === GLOBAL) {
      next.status = newMeta
      if (to === 'approved') {
        next.content = { ...p.content, version: p.content.version + 1 }
        next.versions = { ...p.versions, [next.content.version]: snapshotGlobal(p) as unknown as VersionText }
        summary = `Approved as version ${next.content.version}`
      }
      snapshot = snapshotGlobal(p)
    } else {
      const v = p.variants[section]
      const approved = to === 'approved'
      next.variants = {
        ...p.variants,
        [section]: { ...v, meta: newMeta, approved: approved ? (pick(v, LOCAL_FIELDS) as unknown as LocalCopy) : v.approved, version: approved ? v.version + 1 : v.version },
      }
      if (approved) summary = `Approved as version ${v.version + 1}`
      snapshot = pick(v, VARIANT_FIELDS)
    }
    next.history = [historyEntry(section, action, summary, to === 'approved' ? snapshot : undefined), ...p.history]
    return next
  }
}

/* ---------------- Same product, other species ---------------- */

/** The same product made for other species (e.g. LARVIVA ProStart for sea bream, sea bass, cod…) */
export function otherSpecies(p: Product, products: Product[] = state.db.products): Product[] {
  return products.filter((x) => x.name === p.name && x.id !== p.id).sort((a, b) => a.species.localeCompare(b.species))
}

/**
 * Copy an edit to the same product for other species. Only the fields that were changed are copied,
 * so anything written specifically for a species stays as it is. Each product keeps its own approval.
 * Local copy: products without a version for the market get one with just these fields.
 */
export function applyToSpecies(sourceId: string, section: Section, patch: Record<string, unknown>, ids: string[], mode: 'draft' | 'submit' | 'minor'): number {
  const src = state.db.products.find((x) => x.id === sourceId)
  if (!src || !ids.length || !Object.keys(patch).length) return 0
  const how = ` (copied from ${src.species})`
  const changed: Product[] = []
  const products = state.db.products.map((p) => {
    if (!ids.includes(p.id)) return p
    let next = p
    if (section === GLOBAL) {
      next = applyGlobal(p, patch as GlobalPatch, { minor: mode === 'minor', how })
      if (mode === 'submit' && next.status.status === 'draft') next = transitioned(next, GLOBAL, 'in_review')
    } else {
      const old = p.variants[section]
      const base: Variant = old ?? { ...emptyLocal(), notes: '', inheritsGlobal: false, websiteStatus: 'not_live', sourceVersion: p.content.version, version: 0, meta: { status: 'draft', updatedBy: state.userId, updatedAt: now() } }
      const v: Variant = { ...base, ...(patch as Partial<Variant>), inheritsGlobal: false }
      const fields = VARIANT_FIELDS.filter((k) => JSON.stringify(base[k]) !== JSON.stringify(v[k]))
      if (!old || fields.length) {
        const minor = mode === 'minor' && !!old && old.meta.status === 'approved'
        v.meta = { ...v.meta, status: minor ? 'approved' : afterEdit(v.meta.status), updatedBy: state.userId, updatedAt: now(), reviewNote: undefined }
        if (minor) v.approved = pick(v, LOCAL_FIELDS) as unknown as LocalCopy
        v.sourceVersion = p.content.version
        next = {
          ...p,
          markets: p.markets.includes(section) ? p.markets : [...p.markets, section],
          variants: { ...p.variants, [section]: v },
          history: [historyEntry(section, minor ? 'minor_update' : old ? 'edited' : 'variant_created', `${minor ? 'Small update to' : old ? 'Changed' : 'Local version started with'} ${listFields(fields)}${how}`, pick(v, VARIANT_FIELDS)), ...p.history],
        }
        if (mode === 'submit' && v.meta.status === 'draft') next = transitioned(next, section, 'in_review')
      }
    }
    if (next !== p) changed.push(next)
    return next
  })
  commitProducts(products, changed)
  const n = changed.length
  if (n) window.setTimeout(() => toast(`Also ${mode === 'submit' ? 'sent for approval' : 'saved'} for ${n} other species`), 50)
  return n
}

/* ---------------- History ---------------- */

export function restoreVersion(id: string, entryId: string) {
  updateProduct(id, (p) => {
    const e = p.history.find((h) => h.id === entryId)
    if (!e?.snapshot) return p
    const snap = structuredClone(e.snapshot) as Record<string, unknown>
    const next: Product = { ...p }
    if (e.section === GLOBAL) {
      for (const k of DETAIL_FIELDS) if (k in snap) Object.assign(next, { [k]: snap[k] })
      next.content = { ...p.content, ...pick(snap, COPY_FIELDS.filter((k) => k in snap)) }
      next.status = { ...p.status, status: 'draft', updatedBy: state.userId, updatedAt: now() }
    } else if (p.variants[e.section]) {
      const v = p.variants[e.section]
      const restored = pick(snap, VARIANT_FIELDS.filter((k) => k in snap))
      next.variants = { ...p.variants, [e.section]: { ...v, ...restored, meta: { ...v.meta, status: 'draft', updatedBy: state.userId, updatedAt: now() } } }
    }
    next.history = [historyEntry(e.section, 'restored', `Restored the version from ${new Date(e.at).toLocaleDateString('en-GB')}`, snap), ...p.history]
    return next
  })
  toast('Earlier version restored as a draft')
}

/* ---------------- Assets (references to The Pond) ---------------- */

export type AssetInput = Pick<AssetRef, 'type' | 'title' | 'scope' | 'pondUrl'> & Partial<Pick<AssetRef, 'description' | 'date' | 'internal' | 'url' | 'file' | 'body'>>

export function addAsset(id: string, input: AssetInput): string {
  const asset: AssetRef = { id: newId('a'), ...input, addedBy: state.userId, addedAt: now() }
  const how = input.file ? 'Uploaded' : input.body != null ? 'Wrote' : 'Linked'
  updateProduct(id, (p) => ({
    ...p,
    // Only one hero image: a new one replaces the old one
    assets: [asset, ...p.assets.filter((a) => !(input.type === 'hero' && a.type === 'hero'))],
    history: [historyEntry('assets', 'asset_added', `${how} ${input.title} (${ASSET_LABEL[input.type]}${input.scope !== GLOBAL ? `, ${marketLabel(input.scope, true)}` : ''})`), ...p.history],
  }))
  toast(`${input.title} added`)
  return asset.id
}

export function updateAsset(id: string, assetId: string, patch: Partial<AssetRef>) {
  updateProduct(id, (p) => {
    const a = p.assets.find((x) => x.id === assetId)
    if (!a) return p
    return {
      ...p,
      assets: p.assets.map((x) => (x.id === assetId ? { ...x, ...patch, updatedAt: now() } : x)),
      history: [historyEntry('assets', 'asset_edited', `Updated ${patch.title ?? a.title}`), ...p.history],
    }
  })
  toast('Saved')
}

export function linkAsset(id: string, assetId: string, pondUrl: string) {
  updateProduct(id, (p) => {
    const a = p.assets.find((x) => x.id === assetId)
    if (!a) return p
    return {
      ...p,
      assets: p.assets.map((x) => (x.id === assetId ? { ...x, pondUrl } : x)),
      history: [historyEntry('assets', 'asset_linked', `Linked ${a.title} to The Pond`), ...p.history],
    }
  })
  toast('Link to The Pond saved')
}

export function removeAsset(id: string, assetId: string) {
  let file: AssetRef['file']
  updateProduct(id, (p) => {
    const a = p.assets.find((x) => x.id === assetId)
    file = a?.file
    const internal = p.internal && { ...p.internal, notes: p.internal.notes.map((n) => ({ ...n, resourceIds: n.resourceIds.filter((r) => r !== assetId) })) }
    return {
      ...p,
      assets: p.assets.filter((x) => x.id !== assetId),
      internal,
      history: [historyEntry('assets', 'asset_removed', `Removed ${a?.title ?? 'an item'}`), ...p.history],
    }
  })
  if (file) removeFile(file)
  toast('Removed', 'info')
}

/* ---------------- Internal information ---------------- */

const internalOf = (p: Product): InternalInfo => p.internal ?? { notes: [], markets: {} }

export function saveNote(id: string, note: Omit<InternalNote, 'id' | 'updatedBy' | 'updatedAt'> & { id?: string }) {
  updateProduct(id, (p) => {
    const info = internalOf(p)
    const existing = note.id && info.notes.find((n) => n.id === note.id)
    const saved: InternalNote = { ...note, id: note.id ?? newId('n'), updatedBy: state.userId, updatedAt: now() }
    return {
      ...p,
      internal: { ...info, notes: existing ? info.notes.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...info.notes] },
      history: [historyEntry(note.scope, 'internal_edited', `${existing ? 'Updated' : 'Added'} internal note “${saved.title}”`), ...p.history],
    }
  })
  toast('Saved')
}

export function removeNote(id: string, noteId: string) {
  updateProduct(id, (p) => {
    const info = internalOf(p)
    const n = info.notes.find((x) => x.id === noteId)
    return {
      ...p,
      internal: { ...info, notes: info.notes.filter((x) => x.id !== noteId) },
      history: [historyEntry(n?.scope ?? GLOBAL, 'internal_edited', `Removed internal note “${n?.title ?? ''}”`), ...p.history],
    }
  })
  toast('Removed', 'info')
}

export function saveMarketInfo(id: string, locale: string, patch: Omit<MarketInfo, 'updatedBy' | 'updatedAt'>) {
  updateProduct(id, (p) => {
    const info = internalOf(p)
    return {
      ...p,
      internal: { ...info, markets: { ...info.markets, [locale]: { ...patch, updatedBy: state.userId, updatedAt: now() } } },
      history: [historyEntry(locale, 'internal_edited', `Updated availability and formats for ${marketLabel(locale, true)}`), ...p.history],
    }
  })
  toast('Saved')
}

/* ---------------- Tagging people ---------------- */

export const TAG_KIND_LABEL: Record<TagKind, string> = {
  review: 'Review', translate: 'Translate or adapt', approve: 'Approve', update: 'Update', fyi: 'For your information',
}

export const openTag = (d: TagDraft) => set({ tagging: d })
export const closeTag = () => set({ tagging: null })

export function tagPerson(id: string, input: Pick<TagRequest, 'to' | 'kind' | 'locale' | 'about' | 'message' | 'due'>) {
  const r: TagRequest = { ...input, id: newId('r'), from: state.userId, status: 'open', createdAt: now() }
  updateProduct(id, (p) => ({
    ...p,
    requests: [r, ...(p.requests ?? [])],
    history: [historyEntry(input.locale, 'tagged', `Tagged ${userName(input.to)}: ${TAG_KIND_LABEL[input.kind].toLowerCase()} ${input.about.toLowerCase()}${input.message ? ` (“${input.message}”)` : ''}`), ...p.history],
  }))
  toast(`${userName(input.to)} tagged`)
}

export function resolveRequest(id: string, requestId: string, done: boolean) {
  updateProduct(id, (p) => {
    const r = p.requests?.find((x) => x.id === requestId)
    if (!r) return p
    return {
      ...p,
      requests: (p.requests ?? []).map((x) => (x.id === requestId ? { ...x, status: done ? 'done' : 'open', doneAt: done ? now() : undefined } : x)),
      history: [historyEntry(r.locale, 'request_done', `${done ? 'Done' : 'Reopened'}: ${TAG_KIND_LABEL[r.kind].toLowerCase()} ${r.about.toLowerCase()} (asked by ${userName(r.from)})`), ...p.history],
    }
  })
  toast(done ? 'Marked as done' : 'Reopened', done ? 'ok' : 'info')
}

/** Open requests addressed to a person, newest first */
export function requestsFor(products: Product[], userId: string) {
  return products.flatMap((p) => (p.requests ?? []).filter((r) => r.to === userId && r.status === 'open').map((r) => ({ product: p, request: r })))
    .sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt))
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
    history: [historyEntry(GLOBAL, 'created', 'Product created')],
    createdAt: t,
  }
  commitProducts([p, ...state.db.products], [p])
  toast(`${input.name} – ${input.species} created`)
  return slug
}

/* ---------------- People ---------------- */

export function updateUser(id: string, patch: Partial<User>) {
  const users = state.db.users.map((u) => (u.id === id ? { ...u, ...patch } : u))
  set({ db: { ...state.db, users } })
  const u = users.find((x) => x.id === id)!
  if (state.storage === 'shared') { sharedUsers.set(id, u); shared.writeUser(u) } else persistLocal()
  // Keep the selected locale valid when the current person's access changes
  if (id === state.userId && !can.viewLocale(u, state.locale)) setLocale(u.defaultLocale)
}
