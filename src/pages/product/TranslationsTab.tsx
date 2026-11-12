import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, X } from 'lucide-react'
import type { Product, User } from '../../types'
import { can, marketState } from '../../data/rules'
import { setMarkets } from '../../data/store'
import { MARKETS, MARKET_BY_ID, marketLabel } from '../../data/reference'
import { Card, Empty, Modal, StatusBadge, UpdatedBy } from '../../components/ui'

export function TranslationsTab({ p, user }: { p: Product; user: User }) {
  const navigate = useNavigate()
  const [adding, setAdding] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const canManage = can.editGlobal(user)
  const available = MARKETS.filter((m) => !p.markets.includes(m.id))
  const open = (loc: string) => navigate(`/products/${p.id}/translations/${loc}`)

  return (
    <Card
      title="Markets and translations"
      actions={canManage ? (
        <div className="row-gap">
          <select id="add-market" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Market to add">
            <option value="">Add a market</option>
            {available.map((m) => <option key={m.id} value={m.id}>{marketLabel(m.id)}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!adding} onClick={() => { setMarkets(p.id, adding); setAdding('') }}><Plus size={14} />Add</button>
        </div>
      ) : undefined}
    >
      <p className="pad-x pad-t muted small">The English text is the master. Each market has its own version, with its own approval.</p>
      {p.markets.length === 0 ? (
        <p className="pad"><Empty text="This product is not sold in any market yet." /></p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Market</th><th>Status</th><th className="hide-md">On the website</th><th className="hide-lg">Last change</th><th /></tr></thead>
            <tbody>
              {p.markets.map((loc) => {
                const v = p.variants[loc]
                return (
                  <tr key={loc} className="row-click" onClick={() => open(loc)}>
                    <td><strong>{MARKET_BY_ID[loc]?.market ?? loc}</strong><span className="muted small block">{MARKET_BY_ID[loc]?.language}{v?.inheritsGlobal ? ', uses the English text' : ''}</span></td>
                    <td><StatusBadge status={marketState(p, loc)} small /></td>
                    <td className="hide-md small">{v ? (v.websiteStatus === 'live' ? 'Live' : 'Not live') : <Empty text="Not yet" />}</td>
                    <td className="hide-lg small">{v ? <UpdatedBy by={v.meta.updatedBy} at={v.meta.updatedAt} /> : <Empty text="Not started" />}</td>
                    <td className="nowrap right">
                      {canManage && (
                        <button className="icon-btn" title={`Remove ${marketLabel(loc)}`} aria-label={`Remove ${marketLabel(loc)}`} onClick={(e) => { e.stopPropagation(); setRemoving(loc) }}><X size={16} /></button>
                      )}
                      <ArrowRight size={16} className="muted" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {removing && (
        <Modal title={`Remove ${marketLabel(removing)}?`} onClose={() => setRemoving(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { setMarkets(p.id, undefined, removing); setRemoving(null) }}>Remove</button>
        </>}>
          <p>{p.name} – {p.species} will no longer be listed as sold in {marketLabel(removing, true)}. Any translation stays in the history.</p>
        </Modal>
      )}
    </Card>
  )
}
