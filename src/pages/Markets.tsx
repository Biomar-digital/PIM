import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentUser, setContext, useStore } from '../data/store'
import { marketCoverage } from '../data/insights'
import { Avatar } from '../components/ui'
import { Legend, StackedBar } from '../components/charts'

const SEGS = [
  { key: 'approved', label: 'Approved' }, { key: 'in_review', label: 'In review' }, { key: 'draft', label: 'Draft' },
  { key: 'outdated', label: 'Outdated' }, { key: 'missing', label: 'Missing' },
] as const

export default function Markets() {
  const products = useStore((s) => s.db.products)
  const users = useStore((s) => s.db.users)
  const me = useStore(currentUser)
  const navigate = useNavigate()
  const rows = useMemo(() => marketCoverage(products), [products])
  const regions = [...new Set(rows.map((r) => r.region))]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Markets & languages</h1>
          <p className="muted">Which local versions exist per market, and what is missing or outdated. Click a market to work in it.</p>
        </div>
      </div>
      <div className="card pad"><Legend items={[...SEGS]} /></div>
      {regions.map((region) => (
        <section key={region} className="card mt">
          <header className="card-head"><h2>{region}</h2></header>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Market</th><th className="hide-md">Local editors</th><th>Products</th><th style={{ width: '34%' }}>Local versions</th><th className="hide-md">On website</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.region === region).map((r) => {
                  const editors = users.filter((u) => u.role === 'local_editor' && u.markets.includes(r.id))
                  return (
                    <tr key={r.id} className={`row-click${me.markets.includes(r.id) ? ' row-mine' : ''}`} onClick={() => { setContext(r.id); navigate(`/products?market=${r.id}`) }}>
                      <td><strong>{r.market}</strong><span className="muted small block">{r.language} · {r.id}</span></td>
                      <td className="hide-md">{editors.length ? <span className="row-gap">{editors.map((u) => <span key={u.id} className="row-gap small"><Avatar name={u.name} size={22} />{u.name}</span>)}</span> : <span className="muted small">Not assigned</span>}</td>
                      <td>{r.total}</td>
                      <td>
                        <StackedBar segments={SEGS.map((s) => ({ key: s.key, label: s.label, value: r.counts[s.key] }))} height={12} />
                        <span className="muted small">{r.counts.approved} approved{r.counts.outdated ? ` · ${r.counts.outdated} outdated` : ''}{r.counts.missing ? ` · ${r.counts.missing} missing` : ''}</span>
                      </td>
                      <td className="hide-md small">{r.live} of {r.total}</td>
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
