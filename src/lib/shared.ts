// Shared storage for the published prototype.
//
// When the PIM runs as a published claude.ai artifact it uses the artifact's shared database:
// every person who opens the link reads and writes the same data, live. Each changed product is
// one document in the `products` collection (the full product record, with its local versions,
// versions and history); changed people are documents in `users`. Products nobody has changed
// yet come from the bundled seed data.
//
// Anywhere else (local development) the data is kept in this browser (IndexedDB) instead.
// In production this file is the one to replace with the PIM's own API and database.
import type { Product, User } from '../types'

type Snap = { id: string; data(): Record<string, unknown> | undefined }
type QuerySnap = { docs: Snap[] }
type DbError = { code: string; message: string }
interface DocRef { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
interface Collection {
  doc(id: string): DocRef
  get(): Promise<QuerySnap>
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void
}
interface DB { collection(path: string): Collection }

export interface SharedHandlers {
  products(byId: Map<string, Product>): void
  users(byId: Map<string, User>): void
  error(message: string): void
}

let db: DB | null = null
let seedVersion = 0

/** Resolve the shared database, or null when this view has none. Waits at most `ms`. */
export async function connect(version: number, ms = 6000): Promise<boolean> {
  seedVersion = version
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude
  if (!claude?.use) return false
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), ms))
  db = (await Promise.race([claude.use('db').catch(() => null), timeout])) as DB | null
  return !!db
}

export const isShared = () => !!db

/** Documents written for an older seed are ignored, so a new seed starts clean. */
function read<T>(s: QuerySnap, key: 'product' | 'user'): Map<string, T> {
  const out = new Map<string, T>()
  for (const d of s.docs) {
    const body = d.data()
    if (body && body.seedVersion === seedVersion && body[key]) out.set(d.id, body[key] as T)
  }
  return out
}

/** Listen to shared changes. Call once. */
export function listen(h: SharedHandlers): () => void {
  if (!db) return () => {}
  const fail = (e: DbError) => h.error(e.code === 'revoked' ? 'Access to shared data was removed.' : 'Live updates stopped. Reload the page to reconnect.')
  const a = db.collection('products').onSnapshot((s) => h.products(read<Product>(s, 'product')), fail)
  const b = db.collection('users').onSnapshot((s) => h.users(read<User>(s, 'user')), fail)
  return () => { a(); b() }
}

/* ---------- Writes: one at a time per document, latest value wins, a few documents in parallel ---------- */

type Job = { path: 'products' | 'users'; id: string; body: Record<string, unknown> | null }
const pending = new Map<string, Job>()
const running = new Set<string>()
const MAX_PARALLEL = 4
let onError: (message: string) => void = () => {}
let onIdle: () => void = () => {}

export function setWriteHandlers(err: (m: string) => void, idle: () => void) { onError = err; onIdle = idle }
export const isSaving = () => pending.size > 0 || running.size > 0

function pump() {
  for (const [key, job] of pending) {
    if (running.size >= MAX_PARALLEL) return
    if (running.has(key)) continue
    pending.delete(key)
    running.add(key)
    const ref = db!.collection(job.path).doc(job.id)
    const write = () => (job.body ? ref.set(job.body) : ref.delete())
    write()
      .catch((e: DbError) => (e?.code === 'unavailable' ? new Promise((r) => setTimeout(r, 400 + Math.random() * 600)).then(write) : Promise.reject(e)))
      .catch((e: DbError) => {
        if (e?.code === 'invalid_argument') onError('You can view this shared PIM but not change it. Ask the owner for Contributor access.')
        else if (e?.code === 'quota_exceeded') onError('The shared database is full. Reset the sample data under People and access.')
        else onError('A change could not be saved to the shared data. Try again.')
      })
      .finally(() => {
        running.delete(key)
        pump()
        if (!isSaving()) onIdle()
      })
  }
}

function queue(job: Job) {
  if (!db) return
  pending.set(`${job.path}/${job.id}`, job)
  pump()
}

export const writeProduct = (p: Product) => queue({ path: 'products', id: p.id, body: { seedVersion, product: p, updatedAt: new Date().toISOString() } })
export const writeUser = (u: User) => queue({ path: 'users', id: u.id, body: { seedVersion, user: u } })

/** Remove every shared change, so everyone is back on the seed data. */
export async function resetShared() {
  if (!db) return
  for (const path of ['products', 'users'] as const) {
    const s = await db.collection(path).get()
    for (const d of s.docs) queue({ path, id: d.id, body: null })
  }
}
