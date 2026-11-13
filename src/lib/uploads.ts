// Uploaded files: internal documents that do not belong in The Pond.
//
// In the published PIM, images, videos, PDFs and text files go to the artifact's shared file store.
// Office files (Word, PowerPoint, Excel) and anything the file store does not take are kept in the
// shared database, split into parts. Locally, files stay in this browser (IndexedDB).
// In production this module is replaced by the PIM's own file storage (for example SharePoint or blob storage).
import type { StoredFile } from '../types'
import { idb } from './idb'
import { sharedDb } from './shared'

type AssetsNs = { upload(b: Blob, o?: { type?: string }): Promise<{ id: string; url: string }>; delete(id: string): Promise<void> }

const FILE_STORE_TYPES = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|quicktime)|application\/pdf|text\/(csv|markdown|plain)|application\/json)$/
const CHUNK = 180_000
export const MAX_DB_BYTES = 8 * 1024 * 1024
export const MAX_STORE_BYTES = 20 * 1024 * 1024

const EXT_TYPE: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', csv: 'text/csv', md: 'text/markdown', txt: 'text/plain', json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
export const ext = (name: string) => (name.split('.').pop() ?? '').toLowerCase()
export const mimeOf = (f: File) => EXT_TYPE[ext(f.name)] ?? f.type ?? 'application/octet-stream'

let assets: Promise<AssetsNs | null> | null = null
function getAssets(): Promise<AssetsNs | null> {
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude
  if (!claude?.use) return Promise.resolve(null)
  assets ??= claude.use('assets').then((a) => (a as AssetsNs | null) ?? null).catch(() => null)
  return assets
}

const newRef = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Store a file and return where it is. Throws an Error with a message people can read. */
export async function storeFile(file: File): Promise<StoredFile> {
  const mime = mimeOf(file)
  const meta = { name: file.name, size: file.size, mime }
  const db = sharedDb()
  if (!db) {
    const ref = newRef()
    await idb.set('blobs', ref, file)
    return { store: 'local', ref, ...meta }
  }
  const a = FILE_STORE_TYPES.test(mime) ? await getAssets() : null
  if (a) {
    if (file.size > MAX_STORE_BYTES) throw new Error('This file is larger than 20 MB. Put it in The Pond and link to it instead.')
    try {
      const r = await a.upload(file, { type: mime })
      return { store: 'asset', ref: r.id, ...meta }
    } catch { /* fall through to the database */ }
  }
  if (file.size > MAX_DB_BYTES) throw new Error('Documents can be up to 8 MB. Put larger files in The Pond or SharePoint and link to them instead.')
  const ref = newRef()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const parts = Math.max(1, Math.ceil(bytes.length / CHUNK))
  try {
    for (let i = 0; i < parts; i++) await db.collection('filechunks').doc(`${ref}-${i}`).set({ data: toBase64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) })
    await db.collection('files').doc(ref).set({ ...meta, parts, at: new Date().toISOString() })
  } catch {
    throw new Error('The file could not be saved to the shared data. You may only have view access.')
  }
  return { store: 'db', ref, ...meta }
}

/** Read a stored file back */
export async function loadFile(f: StoredFile): Promise<Blob> {
  if (f.store === 'local') {
    const b = await idb.get<Blob>('blobs', f.ref)
    if (!b) throw new Error('This file was uploaded in another browser.')
    return b
  }
  if (f.store === 'asset') return fetch(`/_blob/${f.ref}`).then((r) => { if (!r.ok) throw new Error('The file could not be loaded.'); return r.blob() })
  const db = sharedDb()
  if (!db) throw new Error('The shared data is not available here.')
  const meta = (await db.collection('files').doc(f.ref).get()).data() as { parts: number } | undefined
  if (!meta) throw new Error('The file could not be found.')
  const chunks: Uint8Array[] = []
  for (let i = 0; i < meta.parts; i++) {
    const d = (await db.collection('filechunks').doc(`${f.ref}-${i}`).get()).data() as { data: string } | undefined
    if (!d) throw new Error('The file is incomplete.')
    chunks.push(fromBase64(d.data))
  }
  return new Blob(chunks as BlobPart[], { type: f.mime })
}

/** Display URL for an image or video stored in the file store (no download needed) */
export const directUrl = (f: StoredFile) => (f.store === 'asset' ? `/_blob/${f.ref}` : null)

export async function removeFile(f: StoredFile) {
  try {
    if (f.store === 'local') await idb.del('blobs', f.ref)
    else if (f.store === 'asset') await (await getAssets())?.delete(f.ref)
    else {
      const db = sharedDb()
      const meta = (await db?.collection('files').doc(f.ref).get())?.data() as { parts: number } | undefined
      for (let i = 0; i < (meta?.parts ?? 0); i++) await db?.collection('filechunks').doc(`${f.ref}-${i}`).delete()
      await db?.collection('files').doc(f.ref).delete()
    }
  } catch { /* the reference is removed anyway */ }
}

export function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}
