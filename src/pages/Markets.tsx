import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentUser, useStore } from '../data/store'
import { marketCoverage } from '../data/insights'
import { MARKET_STATE_LABEL, type MarketState } from '../data/rules'
import { Avatar } from '../components/ui'

const SEGS: MarketState[] = ['approved', 'in_review', 'draft', 'needs_update', 'not_started']

export default function Markets() {
  const products = useStore((s) => s.db.products)
  const users = useStore((s) => s.db.users)
  const me = useStore(currentUser)
  const navigate = useNavigate()
  const rows = useMemo(() => marketCoverage(products).filter((r) => r.total > 0 || me.markets.includes(r.id)), [products, me])
  const regions = [...new Set(rows.map((r) => r.region))]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Markets</h1>
          <p className="muted">How far each market is with its translations. Select a market to see its products.</p>
        </div>
      </div>
      <ul className="legend card pad">
        {SEGS.map((s) => <li key={s}><span className={`legend-dot seg-${s}`} />{MARKET_STATE_LABEL[s]}</li>)}
      </ul>
      {regions.map((region) => (
        <section key={region} className="card mt">
          <header className="card-head"><h2>{region}</h2></header>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Market</th><th className="hide-md">Local team</th><th className="num">Products</th><th style={{ width: '38%' }}>Translations</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.region === region).map((r) => {
                  const editors = users.filter((u) => u.role === 'local_editor' && u.markets.includes(r.id))
                  const open = r.counts.needs_update + r.counts.not_started
                  return (
                    <tr key={r.id} className={`row-click${me.markets.includes(r.id) ? ' row-mine' : ''}`} onClick={() => navigate(`/products?market=${r.id}`)}>
                      <td><strong>{r.market}</strong><span className="muted small block">{r.language}</span></td>
                      <td className="hide-md">{editors.length ? <span className="row-gap wrap">{editors.map((u) => <span key={u.id} className="row-gap small"><Avatar name={u.name} size={22} />{u.name}</span>)}</span> : <span className="empty-value">No one assigned</span>}</td>
                      <td className="num">{r.total}</td>
                      <td>
                        <div className="stack" role="img" aria-label={SEGS.map((s) => `${MARKET_STATE_LABEL[s]}: ${r.counts[s]}`).join(', ')}>
                          {r.total === 0 && <div className="stack-seg seg-empty" style={{ flex: 1 }} />}
                          {SEGS.filter((s) => r.counts[s] > 0).map((s) => <div key={s} className={`stack-seg seg-${s}`} style={{ flex: r.counts[s] }} title={`${MARKET_STATE_LABEL[s]}: ${r.counts[s]}`} />)}
                        </div>
                        <span className="small muted">{r.counts.approved} approved{open ? `, ${open} need work` : ''}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
