import { useState } from 'react'
import { Download, ExternalLink, Link2, Plus, Trash2 } from 'lucide-react'
import type { AssetRef, AssetType, Product, User } from '../../types'
import { ASSET_TYPES, GLOBAL, marketLabel } from '../../data/reference'
import { can, editableLocales } from '../../data/rules'
import { addAsset, linkAsset, removeAsset, userName } from '../../data/store'
import { downloadPreview, previewUrl } from '../../lib/files'
import { formatDate } from '../../lib/format'
import { Card, Empty, GlobalLock, Modal } from '../../components/ui'
import { localeName } from '../../components/Layout'

const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim())

/**
 * Assets linked to the product. The files live in The Pond; the PIM keeps the references.
 * In a locale you see the global assets plus that locale's own documents.
 */
export function AssetsTab({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const [adding, setAdding] = useState<AssetType | null>(null)
  const [linking, setLinking] = useState<AssetRef | null>(null)
  const [removing, setRemoving] = useState<AssetRef | null>(null)
  const visible = p.assets.filter((a) => loc === GLOBAL || a.scope === GLOBAL || a.scope === loc)
  const canAddAny = ASSET_TYPES.some((t) => can.manageAsset(user, t.id, t.global ? GLOBAL : loc))

  return (
    <div className="stack-gap">
      <div className="note">
        <Link2 size={18} />
        <div className="grow">
          The files themselves live in <strong>The Pond</strong>. The PIM keeps a link to each one, so there is a single copy.
          {loc !== GLOBAL && <> You see the global assets and the documents added for {localeName(loc)}.</>}
        </div>
        {canAddAny && <button className="btn btn-primary btn-sm" onClick={() => setAdding('document')}><Plus size={14} />Link an asset</button>}
      </div>

      {ASSET_TYPES.map((t) => {
        const items = visible.filter((a) => a.type === t.id)
        const scope = t.global ? GLOBAL : loc
        const canAdd = can.manageAsset(user, t.id, scope)
        return (
          <Card key={t.id} className="asset-group"
            title={<>{t.plural}<span className="attr-count">{t.hint}</span></>}
            actions={<>
              {t.global && <GlobalLock editable={can.editGlobal(user)} label="Global team only" />}
              {canAdd && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(t.id)}><Plus size={14} />Link</button>}
            </>}>
            {items.length === 0
              ? <p className="pad muted small"><Empty text={t.required ? 'Missing. Needed before the product is ready to use.' : 'None linked yet'} /></p>
              : <div className="asset-list">{items.map((a) => (
                <AssetRow key={a.id} a={a} canManage={can.manageAsset(user, a.type, a.scope)} onLink={() => setLinking(a)} onRemove={() => setRemoving(a)} />
              ))}</div>}
          </Card>
        )
      })}

      {adding && <AddAssetModal p={p} user={user} loc={loc} type={adding} onClose={() => setAdding(null)} />}
      {linking && <LinkModal a={linking} onClose={() => setLinking(null)} onSave={(url) => { linkAsset(p.id, linking.id, url); setLinking(null) }} />}
      {removing && (
        <Modal title="Remove this asset?" onClose={() => setRemoving(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { removeAsset(p.id, removing.id); setRemoving(null) }}>Remove</button>
        </>}>
          <p>{removing.title} is removed from this product. The file stays in The Pond.</p>
        </Modal>
      )}
    </div>
  )
}

function AssetRow({ a, canManage, onLink, onRemove }: { a: AssetRef; canManage: boolean; onLink: () => void; onRemove: () => void }) {
  const url = previewUrl(a)
  return (
    <div className="asset-row">
      <div className="asset-thumb">{url ? <img src={url} alt="" /> : <span className="asset-ext">{a.type === 'datasheet' || a.type === 'brochure' ? 'PDF' : 'FILE'}</span>}</div>
      <div className="grow min0">
        <strong className="clamp-1">{a.title}</strong>
        <span className="muted small block">
          <span className={`scope-tag${a.scope === GLOBAL ? ' global' : ''}`}>{a.scope === GLOBAL ? 'Global' : marketLabel(a.scope, true)}</span>
          {' '}Added by {userName(a.addedBy)}, {formatDate(a.addedAt)}
        </span>
        {!a.pondUrl && <span className="small warn-text block">Not linked to The Pond yet{url ? ': a preview copy is kept in the PIM' : ''}</span>}
      </div>
      <div className="row-gap">
        {a.pondUrl
          ? <a className="btn btn-secondary btn-sm" href={a.pondUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open in The Pond</a>
          : canManage && <button className="btn btn-secondary btn-sm" onClick={onLink}><Link2 size={14} />Link to The Pond</button>}
        {url && <button className="icon-btn" onClick={() => downloadPreview(a)} title="Download the preview" aria-label="Download the preview"><Download size={16} /></button>}
        {canManage && <button className="icon-btn danger" onClick={onRemove} title="Remove" aria-label={`Remove ${a.title}`}><Trash2 size={16} /></button>}
      </div>
    </div>
  )
}

function AddAssetModal({ p, user, loc, type, onClose }: { p: Product; user: User; loc: string; type: AssetType; onClose: () => void }) {
  const types = ASSET_TYPES.filter((t) => (t.global ? can.editGlobal(user) : can.editGlobal(user) || editableLocales(user).length > 0))
  const [t, setT] = useState<AssetType>(types.some((x) => x.id === type) ? type : types[0]?.id ?? 'document')
  const def = ASSET_TYPES.find((x) => x.id === t)!
  // Global assets are always global. Local documents go to a locale the person edits (or Global for the global team).
  const scopes = def.global ? [GLOBAL] : [...(can.editGlobal(user) ? [GLOBAL] : []), ...editableLocales(user)]
  const [scope, setScope] = useState(scopes.includes(loc) ? loc : scopes[0])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const sc = scopes.includes(scope) ? scope : scopes[0]
  const ok = title.trim() && isUrl(url) && sc
  return (
    <Modal title="Link an asset from The Pond" onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!ok} onClick={() => { addAsset(p.id, { type: t, title: title.trim(), scope: sc, pondUrl: url.trim() }); onClose() }}>Link asset</button>
    </>}>
      <div className="stack-gap-sm">
        <label className="field"><span>What is it?</span>
          <select id="asset-type" value={t} onChange={(e) => setT(e.target.value as AssetType)}>
            {types.map((x) => <option key={x.id} value={x.id}>{x.label}{x.global ? ' (global)' : ''}</option>)}
          </select>
        </label>
        {t === 'hero' && p.assets.some((a) => a.type === 'hero') && <p className="small warn-text">This replaces the current hero image.</p>}
        <label className="field"><span>Name</span>
          <input id="asset-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`For example: ${p.name} ${p.species} ${def.label.toLowerCase()}`} />
        </label>
        <label className="field"><span>Link in The Pond</span>
          <input id="asset-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
          <span className="muted small">Open the asset in The Pond and copy its link.</span>
        </label>
        <label className="field"><span>Used in</span>
          <select id="asset-scope" value={sc} onChange={(e) => setScope(e.target.value)} disabled={scopes.length < 2}>
            {scopes.map((s) => <option key={s} value={s}>{s === GLOBAL ? 'Every locale (global)' : `${localeName(s)} only`}</option>)}
          </select>
          {def.global && <span className="muted small">{def.label}s are global: the same in every locale, managed by the global team.</span>}
        </label>
      </div>
    </Modal>
  )
}

function LinkModal({ a, onClose, onSave }: { a: AssetRef; onClose: () => void; onSave: (url: string) => void }) {
  const [url, setUrl] = useState('')
  return (
    <Modal title={`Link ${a.title} to The Pond`} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!isUrl(url)} onClick={() => onSave(url.trim())}>Save link</button>
    </>}>
      <label className="field"><span>Link in The Pond</span>
        <input id="pond-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
        <span className="muted small">Open the asset in The Pond and copy its link. The preview copy in the PIM is kept until The Pond can show previews here.</span>
      </label>
    </Modal>
  )
}
