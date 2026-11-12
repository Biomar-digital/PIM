import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import type { Asset, AssetType, Product, User } from '../../types'
import { can } from '../../data/rules'
import { removeAsset } from '../../data/store'
import { ASSET_TYPES } from '../../data/reference'
import { FileCard, PreviewModal, UploadModal } from '../../components/files'
import { Card, Modal } from '../../components/ui'

export function FilesTab({ p, user }: { p: Product; user: User }) {
  const [preview, setPreview] = useState<Asset | null>(null)
  const [upload, setUpload] = useState<AssetType | null>(null)
  const [confirm, setConfirm] = useState<Asset | null>(null)
  const globalEditor = can.editGlobal(user)
  const myMarkets = p.markets.filter((m) => can.editMarket(user, m))
  const scopes = globalEditor ? ['global', ...p.markets] : myMarkets
  const canUpload = scopes.length > 0
  const canDelete = (a: Asset) => (a.scope === 'global' ? globalEditor : can.editMarket(user, a.scope))

  return (
    <Card title="Files" actions={canUpload ? <button className="btn btn-primary btn-sm" onClick={() => setUpload('datasheet')}><Upload size={14} />Add files</button> : undefined}>
      <div className="file-groups">
        {ASSET_TYPES.map((t) => {
          const items = p.assets.filter((a) => a.type === t.id)
          const hasGlobal = items.some((a) => a.scope === 'global')
          return (
            <section key={t.id} className="file-group">
              <div className="file-group-head">
                <h3>{t.label}</h3>
                <span className="muted small">{t.hint}</span>
              </div>
              <div className="file-grid">
                {items.map((a) => <FileCard key={a.id} p={p} a={a} onPreview={() => setPreview(a)} onDelete={canDelete(a) ? () => setConfirm(a) : undefined} />)}
                {!hasGlobal && (
                  canUpload ? (
                    <button className="fcard fcard-add" onClick={() => setUpload(t.id)}><Plus size={22} /><span>Add {t.label.toLowerCase()}</span></button>
                  ) : (
                    <div className="fcard fcard-add disabled"><span className="empty-value">{t.required ? 'Missing' : 'None yet'}</span></div>
                  )
                )}
              </div>
            </section>
          )
        })}
      </div>
      {preview && <PreviewModal a={preview} onClose={() => setPreview(null)} />}
      {upload && <UploadModal p={p} defaultType={upload} defaultScope={scopes[0]} scopes={scopes} onClose={() => setUpload(null)} />}
      {confirm && (
        <Modal title="Delete this file?" onClose={() => setConfirm(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { removeAsset(p.id, confirm.id); setConfirm(null) }}>Delete</button>
        </>}>
          <p><strong>{confirm.fileName}</strong> will be removed from {p.name} – {p.species}. The history keeps a record of it.</p>
        </Modal>
      )}
    </Card>
  )
}
