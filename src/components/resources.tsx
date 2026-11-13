// Files and content items related to a product: one list, used by Assets, Content and Internal information.
import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, FileText, Link2, Lock, Pencil, Trash2, UploadCloud } from 'lucide-react'
import type { AssetRef, AssetType, Product, User } from '../types'
import { ASSET_LABEL, ASSET_TYPES, GLOBAL, marketLabel } from '../data/reference'
import { can, editableLocales } from '../data/rules'
import { addAsset, toast, updateAsset, userName, type AssetInput } from '../data/store'
import { downloadPreview, previewUrl } from '../lib/files'
import { directUrl, ext, formatBytes, loadFile, storeFile } from '../lib/uploads'
import { saveFile } from '../lib/save'
import { formatDate } from '../lib/format'
import { CopyButton, Modal } from './ui'
import { localeName } from './Layout'

/* ---------- Format ---------- */

export type FormatKind = 'word' | 'powerpoint' | 'excel' | 'pdf' | 'image' | 'video' | 'text' | 'link' | 'pond' | 'other'
export const FORMAT_LABEL: Record<FormatKind, string> = {
  word: 'Word', powerpoint: 'PowerPoint', excel: 'Excel', pdf: 'PDF', image: 'Image', video: 'Video', text: 'Written in the PIM', link: 'Web link', pond: 'The Pond', other: 'Other file',
}
const KIND_BY_EXT: Record<string, FormatKind> = {
  doc: 'word', docx: 'word', ppt: 'powerpoint', pptx: 'powerpoint', xls: 'excel', xlsx: 'excel', csv: 'excel', pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', mp4: 'video', mov: 'video', webm: 'video',
}

export function formatOf(a: AssetRef): { kind: FormatKind; badge: string } {
  if (a.body != null) return { kind: 'text', badge: 'TEXT' }
  const name = a.file?.name ?? a.preview ?? a.fileName ?? ''
  if (name) {
    const e = ext(name)
    return { kind: KIND_BY_EXT[e] ?? 'other', badge: e.toUpperCase().slice(0, 4) || 'FILE' }
  }
  const link = a.url || a.pondUrl
  const e = link ? ext(new URL(link, 'https://x').pathname) : ''
  if (KIND_BY_EXT[e]) return { kind: KIND_BY_EXT[e], badge: e.toUpperCase() }
  if (a.pondUrl) return { kind: 'pond', badge: 'POND' }
  return { kind: 'link', badge: 'LINK' }
}

export const sourceLabel = (a: AssetRef) => (a.file ? 'Uploaded' : a.body != null ? 'Written in the PIM' : a.pondUrl ? 'The Pond' : a.url ? 'Web link' : a.preview ? 'Preview only' : '')

/* ---------- Opening ---------- */

export async function openResource(a: AssetRef) {
  if (a.file) {
    try { await saveFile(await loadFile(a.file), a.file.name) } catch (e) { toast((e as Error).message, 'error') }
  } else if (a.preview) downloadPreview(a)
}

/** Thumbnail: the image itself when there is one, otherwise a coloured format badge */
function Thumb({ a }: { a: AssetRef }) {
  const f = formatOf(a)
  const url = previewUrl(a) ?? (a.file && f.kind === 'image' ? directUrl(a.file) : null)
  return (
    <div className={`asset-thumb fmt-${f.kind}`}>
      {url ? <img src={url} alt="" /> : <span className="asset-ext">{f.badge}</span>}
    </div>
  )
}

/* ---------- List ---------- */

export function ResourceList({ user, items, empty, onEdit, onRemove, onLinkPond, compact }: {
  user: User
  items: AssetRef[]
  empty?: string
  onEdit?: (a: AssetRef) => void
  onRemove?: (a: AssetRef) => void
  onLinkPond?: (a: AssetRef) => void
  compact?: boolean
}) {
  const [reading, setReading] = useState<AssetRef | null>(null)
  if (!items.length) return empty ? <p className="pad muted small">{empty}</p> : null
  return (
    <>
      <div className={`asset-list${compact ? ' compact' : ''}`}>
        {items.map((a) => {
          const manage = can.manageAsset(user, a.type, a.scope)
          const f = formatOf(a)
          return (
            <div key={a.id} className="asset-row">
              <Thumb a={a} />
              <div className="grow min0">
                <strong className="asset-title">{a.title}</strong>
                {a.description && !compact && <p className="small asset-desc">{a.description}</p>}
                <span className="asset-meta small">
                  <span className={`scope-tag${a.scope === GLOBAL ? ' global' : ''}`}>{a.scope === GLOBAL ? 'Global' : marketLabel(a.scope, true)}</span>
                  {a.internal && <span className="internal-tag"><Lock size={11} />Internal</span>}
                  <span>{ASSET_LABEL[a.type]}</span>
                  <span>{FORMAT_LABEL[f.kind]}{a.file ? `, ${formatBytes(a.file.size)}` : ''}</span>
                  {a.date && <span>{formatDate(a.date)}</span>}
                  {!compact && <span className="muted">Added by {userName(a.addedBy)}</span>}
                </span>
                {!a.pondUrl && !a.url && !a.file && a.body == null && a.preview && <span className="small warn-text block">Not linked to The Pond yet: a preview copy is kept in the PIM</span>}
              </div>
              <div className="row-gap asset-actions">
                {a.pondUrl && <a className="btn btn-secondary btn-sm" href={a.pondUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />The Pond</a>}
                {a.url && <a className="btn btn-secondary btn-sm" href={a.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open</a>}
                {a.body != null && <button className="btn btn-secondary btn-sm" onClick={() => setReading(a)}><FileText size={14} />Read</button>}
                {a.file && <button className="btn btn-secondary btn-sm" onClick={() => openResource(a)}><Download size={14} />Download</button>}
                {!a.pondUrl && a.preview && manage && onLinkPond && <button className="btn btn-secondary btn-sm" onClick={() => onLinkPond(a)}><Link2 size={14} />Link to The Pond</button>}
                {a.preview && !a.file && <button className="icon-btn" onClick={() => openResource(a)} title="Download the preview" aria-label="Download the preview"><Download size={16} /></button>}
                {manage && onEdit && <button className="icon-btn" onClick={() => onEdit(a)} title="Edit" aria-label={`Edit ${a.title}`}><Pencil size={16} /></button>}
                {manage && onRemove && <button className="icon-btn danger" onClick={() => onRemove(a)} title="Remove" aria-label={`Remove ${a.title}`}><Trash2 size={16} /></button>}
              </div>
            </div>
          )
        })}
      </div>
      {reading && (
        <Modal title={reading.title} wide onClose={() => setReading(null)} footer={<>
          <CopyButton text={reading.body ?? ''} label="Copy text" />
          <button className="btn btn-primary" onClick={() => setReading(null)}>Close</button>
        </>}>
          {reading.description && <p className="muted">{reading.description}</p>}
          <div className="prose text-body">{(reading.body ?? '').split(/\n\n+/).map((t, i) => <p key={i}>{t}</p>)}</div>
        </Modal>
      )}
    </>
  )
}

/* ---------- Add and edit ---------- */

type Source = 'upload' | 'pond' | 'link' | 'text'
const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim())
const TEXT_TYPES: AssetType[] = ['article', 'social', 'document', 'presentation', 'trial']

/** Types this person may add, and the scopes they may use for a type */
export function addableTypes(user: User) {
  return ASSET_TYPES.filter((t) => (t.global ? can.editGlobal(user) : can.editGlobal(user) || editableLocales(user).length > 0))
}
function scopesFor(user: User, type: AssetType) {
  const def = ASSET_TYPES.find((x) => x.id === type)!
  return def.global ? [GLOBAL] : [...(can.editGlobal(user) ? [GLOBAL] : []), ...editableLocales(user)]
}

/** Add a file or content item (upload, The Pond, a web link, or text), or edit an existing one */
export function ResourceModal({ p, user, loc, type, internal, editing, onClose, onSaved }: {
  p: Product
  user: User
  loc: string
  type?: AssetType
  internal?: boolean
  editing?: AssetRef
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const types = addableTypes(user)
  const [t, setT] = useState<AssetType>(editing?.type ?? (type && types.some((x) => x.id === type) ? type : types[0]?.id ?? 'document'))
  const initialSource: Source = editing ? (editing.file ? 'upload' : editing.body != null ? 'text' : editing.url ? 'link' : 'pond') : 'upload'
  const [source, setSource] = useState<Source>(initialSource)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [date, setDate] = useState(editing?.date ?? '')
  const [isInternal, setInternal] = useState(editing?.internal ?? internal ?? false)
  const [pond, setPond] = useState(editing?.pondUrl ?? '')
  const [link, setLink] = useState(editing?.url ?? '')
  const [body, setBody] = useState(editing?.body ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const scopes = scopesFor(user, t)
  const [scope, setScope] = useState(editing?.scope ?? (scopes.includes(loc) ? loc : scopes[0]))
  const sc = scopes.includes(scope) ? scope : scopes[0]
  const def = ASSET_TYPES.find((x) => x.id === t)!
  useEffect(() => { if (file && !title) setTitle(file.name.replace(/\.[^.]+$/, '')) }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  const sourceOk = source === 'upload' ? !!file || !!editing?.file : source === 'pond' ? isUrl(pond) : source === 'link' ? isUrl(link) : !!body.trim()
  const ok = title.trim() && sc && sourceOk && !busy

  const save = async () => {
    setBusy(true); setError('')
    try {
      const stored = source === 'upload' && file ? await storeFile(file) : source === 'upload' ? editing?.file : undefined
      const data: AssetInput = {
        type: t, title: title.trim(), scope: sc, description: description.trim() || undefined, date: date || undefined, internal: isInternal || undefined,
        pondUrl: source === 'pond' ? pond.trim() : '', url: source === 'link' ? link.trim() : undefined,
        file: stored, body: source === 'text' ? body : undefined,
      }
      if (editing) {
        // Keep the bundled preview when only the details change
        updateAsset(p.id, editing.id, { ...data, pondUrl: source === 'pond' ? pond.trim() : editing.preview ? editing.pondUrl : '' })
        onSaved?.(editing.id)
      } else {
        const id = addAsset(p.id, data)
        onSaved?.(id)
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const sources: [Source, string][] = [['upload', 'Upload a file'], ['pond', 'Link to The Pond'], ['link', 'Link to a web page'], ...(TEXT_TYPES.includes(t) ? [['text', 'Write it here'] as [Source, string]] : [])]
  return (
    <Modal title={editing ? `Edit ${editing.title}` : 'Add a file or content'} wide onClose={onClose} footer={<>
      {error && <span className="small todo-count grow">{error}</span>}
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!ok} onClick={save}>{busy ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
    </>}>
      <div className="seg seg-text source-seg" role="tablist" aria-label="How to add it">
        {sources.map(([id, label]) => <button key={id} role="tab" aria-selected={source === id} className={source === id ? 'on' : ''} onClick={() => setSource(id)}>{label}</button>)}
      </div>

      {source === 'upload' && (
        <div className={`drop${file ? ' has-file' : ''}`} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]) }}>
          <UploadCloud size={28} />
          <strong>{file ? file.name : editing?.file ? `${editing.file.name} (choose a file to replace it)` : 'Drop a file here or click to choose'}</strong>
          <span className="muted small">{file ? formatBytes(file.size) : 'Word, PowerPoint, Excel, PDF, images and videos. Documents up to 8 MB, images, videos and PDFs up to 20 MB.'}</span>
          <input id="resource-file" ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        </div>
      )}
      {source === 'pond' && (
        <label className="field"><span>Link in The Pond</span>
          <input id="resource-pond" value={pond} onChange={(e) => setPond(e.target.value)} placeholder="https://" inputMode="url" />
          <span className="muted small">Open the asset in The Pond and copy its link. The file stays in The Pond.</span>
        </label>
      )}
      {source === 'link' && (
        <label className="field"><span>Web address</span>
          <input id="resource-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" inputMode="url" />
          <span className="muted small">SharePoint, YouTube, LinkedIn or any other page.</span>
        </label>
      )}
      {source === 'text' && (
        <label className="field"><span>Text</span>
          <textarea id="resource-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
      )}

      <div className="form-grid">
        <label className="field span-2"><span>Title</span>
          <input id="resource-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field span-2"><span>Short description</span>
          <textarea id="resource-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field"><span>Content type</span>
          <select id="resource-type" value={t} onChange={(e) => { const nt = e.target.value as AssetType; setT(nt); if (source === 'text' && !TEXT_TYPES.includes(nt)) setSource('upload') }}>
            {types.map((x) => <option key={x.id} value={x.id}>{x.label}{x.global ? ' (global)' : ''}</option>)}
          </select>
        </label>
        <label className="field"><span>Market</span>
          <select id="resource-scope" value={sc} onChange={(e) => setScope(e.target.value)} disabled={scopes.length < 2}>
            {scopes.map((s) => <option key={s} value={s}>{s === GLOBAL ? 'Global (every market)' : localeName(s)}</option>)}
          </select>
        </label>
        <label className="field"><span>Date</span>
          <input id="resource-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="check resource-internal"><input type="checkbox" checked={isInternal} onChange={(e) => setInternal(e.target.checked)} />Internal use only</label>
      </div>
      {def.global && <p className="muted small">{def.label}s are global: the same in every market, managed by the global team.</p>}
      {t === 'hero' && !editing && p.assets.some((a) => a.type === 'hero') && <p className="small warn-text">This replaces the current hero image.</p>}
    </Modal>
  )
}

