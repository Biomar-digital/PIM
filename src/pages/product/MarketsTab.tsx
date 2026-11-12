import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, X } from 'lucide-react'
import type { Product, User } from '../../types'
import { can, variantMissingFields, variantState } from '../../data/rules'
import { setContext, setMarkets } from '../../data/store'
import { MARKETS, marketLabel, MARKET_BY_ID } from '../../data/reference'
import { Card, StatusBadge, UpdatedBy } from '../../components/ui'

export function MarketsTab({ p, user }: { p: Product; user: User }) {
  const navigate = useNavigate()
  const [adding, setAdding] = useState('')
  const canEdit = can.editGlobal(user)
  const open = (loc: string) => { setContext(loc); navigate(`/products/${p.id}/marketing`, { replace: true }) }
  const available = MARKETS.filter((m) => !p.markets.includes(m.id))
  const extra = Object.keys(p.variants).filter((l) => !p.markets.includes(l))

  return (
    <Card
      title={<>Markets & languages <span className="muted small">· {p.markets.length} target market{p.markets.length === 1 ? '' : 's'}</span></>}
      actions={canEdit ? (
        <div className="row-gap">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add market">
            <option value="">Add market…</option>
            {available.map((m) => <option key={m.id} value={m.id}>{m.market} – {m.language}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!adding} onClick={() => { setMarkets(p.id, adding); setAdding('') }}><Plus size={14} /> Add</button>
        </div>
      ) : undefined}
    >
      <p className="pad-x muted small">One global record, with a local version per market and language. Target markets without local content show as missing.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Market</th><th>Language</th><th>Local version</th><th className="hide-md">Content</th><th className="hide-md">Website</th><th className="hide-lg">Last updated</th><th /></tr></thead>
          <tbody>
            <tr className="row-global">
              <td><strong>Global</strong></td><td>English (master)</td>
              <td><StatusBadge status={p.marketing.meta.status} small /></td>
              <td className="hide-md small">v{p.marketing.version}</td>
              <td className="hide-md small muted">—</td>
              <td className="hide-lg"><UpdatedBy by={p.marketing.meta.updatedBy} at={p.marketing.meta.updatedAt} /></td>
              <td><button className="icon-btn" onClick={() => open('global')} aria-label="Open global"><ArrowRight size={16} /></button></td>
            </tr>
            {[...p.markets, ...extra].map((loc) => {
              const v = p.variants[loc]
              const st = variantState(p, loc)
              const miss = v ? variantMissingFields(v) : []
              return (
                <tr key={loc} className="row-click" onClick={() => open(loc)}>
                  <td><strong>{MARKET_BY_ID[loc]?.market ?? loc}</strong>{!p.markets.includes(loc) && <span className="muted small block">Not a target market</span>}</td>
                  <td>{MARKET_BY_ID[loc]?.language}</td>
                  <td><StatusBadge status={st} small /></td>
                  <td className="hide-md small">{!v ? <span className="muted">—</span> : v.inheritsGlobal ? 'Uses global English' : miss.length ? <span className="warn-text">Missing {miss.join(', ').toLowerCase()}</span> : `Based on v${v.sourceVersion}`}</td>
                  <td className="hide-md small">{v ? (v.websiteStatus === 'live' ? <span className="tag tag-ok">Live</span> : <span className="tag tag-muted">Not live</span>) : '—'}</td>
                  <td className="hide-lg">{v ? <UpdatedBy by={v.meta.updatedBy} at={v.meta.updatedAt} /> : <span className="muted small">—</span>}</td>
                  <td className="nowrap">
                    {canEdit && p.markets.includes(loc) && (
                      <button className="icon-btn" title={`Remove ${marketLabel(loc)} as target market`} aria-label="Remove market" onClick={(e) => { e.stopPropagation(); setMarkets(p.id, undefined, loc) }}><X size={16} /></button>
                    )}
                    <button className="icon-btn" aria-label="Open"><ArrowRight size={16} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
