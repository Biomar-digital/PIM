import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ClipboardCheck, FileWarning, Image as ImageIcon, Languages, Package } from 'lucide-react'
import { currentUser, setContext, useStore, userName } from '../data/store'
import { completeness, overallStatus } from '../data/rules'
import { marketCoverage, workItems } from '../data/insights'
import { marketLabel } from '../data/reference'
import { bannerSvg, productThumb } from '../lib/artwork'
import { productTitle, timeAgo } from '../lib/format'
import { Avatar, Card, CompletenessBar, Thumb } from '../components/ui'
import { Legend, StackedBar } from '../components/charts'

const STATUS_SEGS = [
  { key: 'approved', label: 'Approved' },
  { key: 'in_review', label: 'In review' },
  { key: 'draft', label: 'Draft' },
]
const VARIANT_SEGS = [...STATUS_SEGS, { key: 'outdated', label: 'Outdated' }, { key: 'missing', label: 'Missing' }]

export default function Dashboard() {
  const products = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const comp = products.map((p) => ({ p, c: completeness(p) }))
    const reviewCount = products.reduce((n, p) => n + [p.info.status, p.marketing.meta.status, ...Object.values(p.variants).map((v) => v.meta.status)].filter((s) => s === 'in_review').length, 0)
    const outdated = comp.reduce((n, { c }) => n + c.missing.filter((m) => m.problem === 'outdated').length, 0)
    const missingAssets = comp.filter(({ c }) => c.missing.some((m) => m.group === 'assets')).length
    const complete = comp.filter(({ c }) => c.score === 100).length
    const byRange = new Map<string, number[]>()
    comp.forEach(({ p, c }) => byRange.set(p.range, [...(byRange.get(p.range) ?? []), c.score]))
    const ranges = [...byRange.entries()].map(([range, s]) => ({ range, n: s.length, avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length) })).sort((a, b) => b.n - a.n)
    const count = (arr: string[]) => Object.fromEntries(STATUS_SEGS.map((s) => [s.key, arr.filter((x) => x === s.key).length]))
    const sections = [
      { label: 'Product information', counts: count(products.map((p) => p.info.status)) },
      { label: 'Marketing content', counts: count(products.map((p) => p.marketing.meta.status)) },
      { label: 'Overall (global)', counts: count(products.map(overallStatus)) },
    ]
    const coverage = marketCoverage(products).filter((m) => m.total > 0).sort((a, b) => b.total - a.total)
    const activity = products.flatMap((p) => p.history.slice(0, 6).map((h) => ({ p, h }))).sort((a, b) => b.h.at.localeCompare(a.h.at)).slice(0, 8)
    return { comp, reviewCount, outdated, missingAssets, complete, ranges, sections, coverage, activity }
  }, [products])

  const work = useMemo(() => workItems(products, user), [products, user])
  const first = user.name.split(' ')[0]

  const go = (tab: string, ctx: string, id: string) => { setContext(ctx); navigate(`/products/${id}/${tab}`) }

  return (
    <div className="page">
      <h1 className="hello">Hello {first}</h1>
      <p className="lead">Welcome to BioMar Product Information – the single place for approved product content.</p>

      <div className="hero-cards">
        <Link to="/products" className="hero-card" style={{ backgroundImage: `url("${bannerSvg('pellets')}")` }}>
          <span className="hero-card-btn">Product library</span>
        </Link>
        <Link to="/approvals" className="hero-card" style={{ backgroundImage: `url("${bannerSvg('fish')}")` }}>
          <span className="hero-card-btn">Approvals{stats.reviewCount ? ` (${stats.reviewCount})` : ''}</span>
        </Link>
      </div>

      <div className="kpis">
        <Kpi icon={<Package />} label="Products" value={products.length} sub={`${stats.complete} fully complete`} to="/products" />
        <Kpi icon={<ClipboardCheck />} label="Waiting for approval" value={stats.reviewCount} sub="content blocks in review" to="/approvals" tone="review" />
        <Kpi icon={<Languages />} label="Outdated local versions" value={stats.outdated} sub="global copy changed since" to="/products?state=outdated" tone="outdated" />
        <Kpi icon={<ImageIcon />} label="Missing required assets" value={stats.missingAssets} sub="products without hero, bag or datasheet" to="/products?issue=assets" tone="missing" />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
        <Card title={<>Needs your attention <span className="count">{work.length}</span></>} className="dash-work">
          {work.length === 0 ? (
            <p className="muted pad">Nothing waiting for you right now.</p>
          ) : (
            <ul className="work-list">
              {work.slice(0, 8).map((w) => (
                <li key={w.key}>
                  <button className="work-item" onClick={() => go(w.tab, w.context, w.product.id)}>
                    <Thumb url={productThumb(w.product, blobUrls)} />
                    <span className="work-text">
                      <span className={`work-title tone-${w.tone}`}>
                        {w.tone === 'review' ? <ClipboardCheck size={14} /> : w.tone === 'outdated' ? <AlertTriangle size={14} /> : w.tone === 'changes' ? <FileWarning size={14} /> : <AlertTriangle size={14} />}
                        {w.title}
                      </span>
                      <strong>{productTitle(w.product)}</strong>
                      <span className="muted small clamp-1">{w.detail}</span>
                    </span>
                    <ArrowRight size={16} className="muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {work.length > 8 && <p className="pad small muted">+ {work.length - 8} more. {user.role === 'approver' ? <Link to="/approvals">Open approvals</Link> : <Link to="/products">Open the library</Link>}</p>}
        </Card>

        <Card title="Local versions by market" actions={<Link to="/markets" className="link-sm">All markets</Link>} className="dash-markets">
          <ul className="coverage-list pad">
            {stats.coverage.slice(0, 9).map((m) => (
              <li key={m.id}>
                <button className="link-btn" onClick={() => { setContext(m.id); navigate('/products?market=' + m.id) }}>{marketLabel(m.id)}</button>
                <StackedBar segments={VARIANT_SEGS.map((x) => ({ ...x, value: m.counts[x.key as keyof typeof m.counts] }))} />
                <span className="muted small num">{m.counts.approved}/{m.total}</span>
              </li>
            ))}
          </ul>
          <div className="pad-x pad-b"><Legend items={VARIANT_SEGS} /></div>
        </Card>

        </div>
        <div className="dash-col">
        <Card title="Content status" className="dash-status">
          <div className="pad stack-list">
            {stats.sections.map((s) => (
              <div key={s.label}>
                <div className="stack-label"><span>{s.label}</span><span className="muted small">{s.counts.approved} of {products.length} approved</span></div>
                <StackedBar segments={STATUS_SEGS.map((x) => ({ ...x, value: s.counts[x.key] }))} />
              </div>
            ))}
            <Legend items={STATUS_SEGS} />
          </div>
        </Card>

        <Card title="Completeness by product range" className="dash-ranges">
          <ul className="range-list pad">
            {stats.ranges.map((r) => (
              <li key={r.range}>
                <Link to={`/products?range=${encodeURIComponent(r.range)}`}>{r.range}</Link>
                <span className="muted small">{r.n}</span>
                <CompletenessBar score={r.avg} />
              </li>
            ))}
          </ul>
        </Card>

        </div>
      </div>
      <div className="mt">
        <Card title="Recent activity" className="dash-activity">
          <ul className="activity">
            {stats.activity.map(({ p, h }) => (
              <li key={h.id}>
                <Avatar name={userName(h.by)} size={28} />
                <div>
                  <div className="small"><strong>{userName(h.by)}</strong> · <Link to={`/products/${p.id}/history`}>{productTitle(p)}</Link></div>
                  <div className="small muted clamp-1">{h.summary}</div>
                </div>
                <span className="small muted nowrap">{timeAgo(h.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, sub, to, tone }: { icon: ReactNode; label: string; value: number; sub: string; to: string; tone?: string }) {
  return (
    <Link to={to} className={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <span className="kpi-icon">{icon}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-sub">{sub}</span>
    </Link>
  )
}

