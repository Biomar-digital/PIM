import { useMemo, useState } from 'react'
import { Link2, Plus, Search, X } from 'lucide-react'
import type { AssetRef, AssetType, Product, User } from '../../types'
import { ASSET_LABEL, ASSET_TYPES, GLOBAL, marketLabel } from '../../data/reference'
import { can } from '../../data/rules'
import { linkAsset, removeAsset } from '../../data/store'
import { Card, Empty, GlobalLock, Modal } from '../../components/ui'
import { FORMAT_LABEL, ResourceList, ResourceModal, addableTypes, formatOf, type FormatKind } from '../../components/resources'

const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim())

/**
 * Every file and content item related to the product: links to The Pond, uploaded documents, web links
 * and text written in the PIM. In a market you see the global items and that market's own.
 */
export function AssetsTab({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const [adding, setAdding] = useState<AssetType | true | null>(null)
  const [editing, setEditing] = useState<AssetRef | null>(null)
  const [linking, setLinking] = useState<AssetRef | null>(null)
  const [removing, setRemoving] = useState<AssetRef | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [format, setFormat] = useState('')
  const [scope, setScope] = useState('')
  const [use, setUse] = useState('')
  const visible = p.assets.filter((a) => loc === GLOBAL || a.scope === GLOBAL || a.scope === loc)
  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return visible.filter((a) => {
      if (terms.length && !terms.every((t) => [a.title, a.description, a.file?.name, a.fileName, a.body, ASSET_LABEL[a.type]].join(' ').toLowerCase().includes(t))) return false
      if (type && a.type !== type) return false
      if (format && formatOf(a).kind !== format) return false
      if (scope && a.scope !== scope) return false
      if (use === 'internal' && !a.internal) return false
      if (use === 'shareable' && a.internal) return false
      return true
    })
  }, [visible, q, type, format, scope, use])
  const filtering = !!(q || type || format || scope || use)
  const formats = [...new Set(visible.map((a) => formatOf(a).kind))]
  const scopes = [...new Set(visible.map((a) => a.scope))]
  const canAdd = addableTypes(user).length > 0
  const clear = () => { setQ(''); setType(''); setFormat(''); setScope(''); setUse('') }

  return (
    <div className="stack-gap">
      <div className="assets-head">
        <p className="muted small grow">Link files from <strong>The Pond</strong>, upload internal documents that do not belong there, or link and write other content. Each item is added once and shows wherever it is relevant.</p>
        {canAdd && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Add a file or content</button>}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden />
          <input id="asset-search" type="search" placeholder="Search titles, descriptions and file names" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search files and content" />
        </label>
      </div>
      <div className="filters">
        <label className={`filter${type ? ' set' : ''}`}><span>Content type</span>
          <select id="asset-f-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            {ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className={`filter${format ? ' set' : ''}`}><span>Format</span>
          <select id="asset-f-format" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">All</option>
            {formats.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f as FormatKind]}</option>)}
          </select>
        </label>
        <label className={`filter${scope ? ' set' : ''}`}><span>Market</span>
          <select id="asset-f-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">All</option>
            {scopes.map((s) => <option key={s} value={s}>{s === GLOBAL ? 'Global' : marketLabel(s, true)}</option>)}
          </select>
        </label>
        <label className={`filter${use ? ' set' : ''}`}><span>Use</span>
          <select id="asset-f-use" value={use} onChange={(e) => setUse(e.target.value)}>
            <option value="">All</option>
            <option value="shareable">Can be shared</option>
            <option value="internal">Internal only</option>
          </select>
        </label>
        {filtering && <button className="link-btn small more-btn" onClick={clear}><X size={14} />Clear</button>}
      </div>

      {filtering && filtered.length === 0 && <p className="muted">Nothing matches. <button className="link-btn" onClick={clear}>Clear the search and filters</button></p>}

      {ASSET_TYPES.map((t) => {
        const items = filtered.filter((a) => a.type === t.id)
        if (filtering && !items.length) return null
        if (!items.length && !t.required && !t.global && !can.manageAsset(user, t.id, t.global ? GLOBAL : loc)) return null
        const canAddHere = can.manageAsset(user, t.id, t.global ? GLOBAL : loc)
        return (
          <Card key={t.id} className="asset-group"
            title={<>{t.plural}{items.length > 0 && <span className="count-pill">{items.length}</span>}</>}
            actions={<>
              {t.global && <GlobalLock editable={can.editGlobal(user)} label="Global team only" />}
              {canAddHere && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(t.id)}><Plus size={14} />Add</button>}
            </>}>
            {items.length === 0
              ? <p className="pad muted small"><Empty text={t.required ? 'Missing. Needed before the product is ready to use.' : 'Nothing added yet'} /></p>
              : <ResourceList user={user} items={items} onEdit={setEditing} onRemove={setRemoving} onLinkPond={setLinking} />}
          </Card>
        )
      })}

      {adding && <ResourceModal p={p} user={user} loc={loc} type={adding === true ? undefined : adding} onClose={() => setAdding(null)} />}
      {editing && <ResourceModal p={p} user={user} loc={loc} editing={editing} onClose={() => setEditing(null)} />}
      {linking && <LinkModal a={linking} onClose={() => setLinking(null)} onSave={(url) => { linkAsset(p.id, linking.id, url); setLinking(null) }} />}
      {removing && (
        <Modal title="Remove this item?" onClose={() => setRemoving(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { removeAsset(p.id, removing.id); setRemoving(null) }}>Remove</button>
        </>}>
          <p>{removing.title} is removed from this product{removing.file ? ', and the uploaded file is deleted' : ''}.{removing.pondUrl ? ' The file stays in The Pond.' : ''}</p>
        </Modal>
      )}
    </div>
  )
}

function LinkModal({ a, onClose, onSave }: { a: AssetRef; onClose: () => void; onSave: (url: string) => void }) {
  const [url, setUrl] = useState('')
  return (
    <Modal title={`Link ${a.title} to The Pond`} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!isUrl(url)} onClick={() => onSave(url.trim())}><Link2 size={16} />Save link</button>
    </>}>
      <label className="field"><span>Link in The Pond</span>
        <input id="pond-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
        <span className="muted small">Open the asset in The Pond and copy its link. The preview copy in the PIM is kept until The Pond can show previews here.</span>
      </label>
    </Modal>
  )
}
