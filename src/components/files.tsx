import { useRef, useState } from 'react'
import { Download, Eye, FileText, Trash2, UploadCloud } from 'lucide-react'
import type { Asset, AssetType, Product } from '../types'
import { ASSET_LABEL, ASSET_TYPES, marketLabel } from '../data/reference'
import { addAsset, useStore, userName } from '../data/store'
import { assetUrl, downloadAsset, isImage } from '../lib/files'
import { formatDate, formatSize } from '../lib/format'
import { Modal } from './ui'

export function FileCard({ p, a, onPreview, onDelete, showProduct }: { p: Product; a: Asset; onPreview: () => void; onDelete?: () => void; showProduct?: boolean }) {
  const blobUrls = useStore((s) => s.blobUrls)
  const url = assetUrl(a, blobUrls)
  return (
    <div className="fcard">
      <button className="fcard-img" onClick={onPreview} aria-label={`Preview ${a.fileName}`}>
        {url && isImage(a) ? <img src={url} alt="" loading="lazy" /> : <FileText size={40} />}
      </button>
      <div className="fcard-body">
        {showProduct && <span className="small strong clamp-1">{p.name} – {p.species}</span>}
        <span className="fcard-name clamp-1" title={a.fileName}>{a.fileName}</span>
        <span className="muted small">{ASSET_LABEL[a.type]} · {a.scope === 'global' ? 'All markets' : marketLabel(a.scope, true)} · {formatSize(a.sizeKb)}</span>
      </div>
      <div className="fcard-actions">
        <button className="icon-btn" onClick={onPreview} aria-label="Preview" title="Preview"><Eye size={16} /></button>
        <button className="icon-btn" onClick={() => downloadAsset(a, blobUrls)} aria-label="Download" title="Download"><Download size={16} /></button>
        {onDelete && <button className="icon-btn danger" onClick={onDelete} aria-label="Delete" title="Delete"><Trash2 size={16} /></button>}
      </div>
    </div>
  )
}

export function PreviewModal({ a, onClose }: { a: Asset; onClose: () => void }) {
  const blobUrls = useStore((s) => s.blobUrls)
  const url = assetUrl(a, blobUrls)
  return (
    <Modal title={a.fileName} onClose={onClose} wide footer={<>
      <span className="muted small grow">
        {ASSET_LABEL[a.type]} · {a.scope === 'global' ? 'All markets' : marketLabel(a.scope)} · {formatSize(a.sizeKb)} ·{' '}
        {a.sourceUrl ? <>from <a href={a.sourceUrl} target="_blank" rel="noreferrer">biomar.com</a></> : <>added by {userName(a.uploadedBy)}, {formatDate(a.uploadedAt)}</>}
      </span>
      <button className="btn btn-primary" onClick={() => downloadAsset(a, blobUrls)}><Download size={16} />Download</button>
    </>}>
      <div className="preview">
        {url && isImage(a) ? <img src={url} alt={a.fileName} /> : <p className="muted pad">No preview for this type of file. Download it to open it.</p>}
      </div>
    </Modal>
  )
}

export function UploadModal({ p, onClose, defaultType = 'datasheet', defaultScope = 'global', scopes }: { p: Product; onClose: () => void; defaultType?: AssetType; defaultScope?: string; scopes: string[] }) {
  const [files, setFiles] = useState<File[]>([])
  const [type, setType] = useState<AssetType>(defaultType)
  const [scope, setScope] = useState(defaultScope)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const upload = async () => {
    setBusy(true)
    for (const f of files) await addAsset(p.id, f, type, scope)
    setBusy(false)
    onClose()
  }
  return (
    <Modal title={`Add files to ${p.name} – ${p.species}`} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!files.length || busy} onClick={upload}>{busy ? 'Adding' : files.length > 1 ? `Add ${files.length} files` : 'Add file'}</button>
    </>}>
      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setFiles([...files, ...Array.from(e.dataTransfer.files)]) }}
        onClick={() => input.current?.click()}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
      >
        <UploadCloud size={32} />
        <strong>Drop files here or click to choose</strong>
        <span className="muted small">Images and PDF files</span>
        <input id="upload-input" ref={input} type="file" multiple hidden accept="image/*,application/pdf" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
      </div>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => <li key={i}><FileText size={14} />{f.name}<span className="muted small">{formatSize(Math.max(1, Math.round(f.size / 1024)))}</span></li>)}
        </ul>
      )}
      <div className="form-grid">
        <label className="field"><span>Type of file</span>
          <select id="upload-type" value={type} onChange={(e) => setType(e.target.value as AssetType)}>{ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </label>
        <label className="field"><span>For</span>
          <select id="upload-scope" value={scope} onChange={(e) => setScope(e.target.value)}>{scopes.map((s) => <option key={s} value={s}>{s === 'global' ? 'All markets' : marketLabel(s)}</option>)}</select>
        </label>
      </div>
      <p className="muted small">In this prototype, files are stored in your browser only.</p>
    </Modal>
  )
}
