import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import type { Asset, AssetType, Product, User } from '../../types'
import { can } from '../../data/rules'
import { removeAsset } from '../../data/store'
import { ASSET_TYPES, marketLabel } from '../../data/reference'
import { AssetCard, PreviewModal, UploadModal } from '../../components/assets'
import { Card, Modal } from '../../components/ui'

export function AssetsTab({ p, user, context }: { p: Product; user: User; context: string }) {
  const [preview, setPreview] = useState<Asset | null>(null)
  const [upload, setUpload] = useState<{ type: AssetType } | null>(null)
  const [confirm, setConfirm] = useState<Asset | null>(null)
  const local = context !== 'global'
  const canEditGlobal = can.editGlobal(user)
  const canEditLocal = local && can.editMarket(user, context)
  const canUpload = canEditGlobal || canEditLocal
  const scopes = canEditGlobal ? ['global', ...p.markets] : local ? [context] : []
  const canDelete = (a: Asset) => (a.scope === 'global' ? canEditGlobal : can.editMarket(user, a.scope))

  const visible = p.assets.filter((a) => !local || a.scope === 'global' || a.scope === context)

  return (
    <Card
      title={<>Assets <span className="muted small">· {local ? `global + ${marketLabel(context, true)}` : 'all markets'}</span></>}
      actions={canUpload ? <button className="btn btn-primary btn-sm" onClick={() => setUpload({ type: 'hero' })}><Upload size={14} /> Upload</button> : undefined}
    >
      <div className="asset-groups">
        {ASSET_TYPES.map((t) => {
          const items = visible.filter((a) => a.type === t.id)
          const hasGlobal = items.some((a) => a.scope === 'global')
          if (!items.length && !t.required) return null
          return (
            <section key={t.id} className="asset-group">
              <div className="asset-group-head">
                <h3>{t.label}{t.required && <span className={`req${hasGlobal ? ' ok' : ''}`}>{hasGlobal ? 'Required ✓' : 'Required – missing'}</span>}</h3>
                <span className="muted small">{t.hint}</span>
              </div>
              <div className="asset-grid">
                {items.map((a) => (
                  <AssetCard key={a.id} p={p} a={a} onPreview={() => setPreview(a)} onDelete={canDelete(a) ? () => setConfirm(a) : undefined} />
                ))}
                {!hasGlobal && t.required && (
                  canUpload ? (
                    <button className="acard acard-add" onClick={() => setUpload({ type: t.id })}><Plus size={24} /><span>Add {t.label.toLowerCase()}</span></button>
                  ) : (
                    <div className="acard acard-add disabled"><span className="muted small">No {t.label.toLowerCase()} yet</span></div>
                  )
                )}
              </div>
            </section>
          )
        })}
      </div>
      {preview && <PreviewModal p={p} a={preview} onClose={() => setPreview(null)} />}
      {upload && <UploadModal p={p} defaultType={upload.type} defaultScope={local && canEditLocal ? context : 'global'} scopes={scopes} onClose={() => setUpload(null)} />}
      {confirm && (
        <Modal title="Delete asset?" onClose={() => setConfirm(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { removeAsset(p.id, confirm.id); setConfirm(null) }}>Delete</button>
        </>}>
          <p><strong>{confirm.fileName}</strong> will be removed from {p.name} – {p.species}. The deletion is recorded in the history.</p>
        </Modal>
      )}
    </Card>
  )
}
