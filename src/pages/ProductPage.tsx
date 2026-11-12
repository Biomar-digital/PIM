import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Globe2, MapPin } from 'lucide-react'
import { currentUser, setContext, useStore, userName } from '../data/store'
import { completeness, overallStatus, variantState, VARIANT_STATE_LABEL } from '../data/rules'
import { LIFECYCLE_LABEL, marketLabel } from '../data/reference'
import { productThumb } from '../lib/artwork'
import { CompletenessRing, EmptyState, StatusBadge, Thumb } from '../components/ui'
import { InfoTab } from './product/InfoTab'
import { MarketingTab } from './product/MarketingTab'
import { AssetsTab } from './product/AssetsTab'
import { MarketsTab } from './product/MarketsTab'
import { HistoryTab } from './product/HistoryTab'
import { SidePanel } from './product/SidePanel'

export const TABS = [
  { id: 'information', label: 'Product information', group: 'info' },
  { id: 'marketing', label: 'Marketing content', group: 'marketing' },
  { id: 'assets', label: 'Assets', group: 'assets' },
  { id: 'markets', label: 'Markets & languages', group: 'markets' },
  { id: 'history', label: 'History', group: '' },
] as const

export default function ProductPage() {
  const { id, tab = 'information' } = useParams()
  const product = useStore((s) => s.db.products.find((p) => p.id === id))
  const context = useStore((s) => s.context)
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const navigate = useNavigate()
  const comp = useMemo(() => (product ? completeness(product) : null), [product])

  if (!product || !comp) {
    return (
      <div className="page">
        <EmptyState title="Product not found"><Link to="/products" className="btn btn-secondary">Back to the library</Link></EmptyState>
      </div>
    )
  }
  const p = product
  const local = context !== 'global'
  const missingBy = (g: string) => comp.missing.filter((m) => m.group === g).length
  const otherMarkets = local && !p.markets.includes(context)

  return (
    <div className="page product-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/products">Product library</Link><ChevronRight size={14} /><span>{p.name} – {p.species}</span>
      </nav>

      <header className="phead card">
        <Thumb url={productThumb(p, blobUrls)} size={88} />
        <div className="phead-main">
          <div className="phead-kicker">{p.range} · {p.category}</div>
          <h1>{p.name} <span className="phead-species">{p.species}</span></h1>
          <div className="phead-meta">
            <StatusBadge status={overallStatus(p)} />
            <span className="muted small">{p.code}</span>
            <span className="muted small">{p.stages.join(', ')}</span>
            {p.lifecycle !== 'active' && <span className="tag tag-warn">{LIFECYCLE_LABEL[p.lifecycle]}</span>}
            <span className="muted small">Owner: {userName(p.owner)}</span>
          </div>
        </div>
        <button className="phead-score" onClick={() => document.getElementById('checklist')?.scrollIntoView({ behavior: 'smooth' })} title="See what is missing">
          <CompletenessRing score={comp.score} size={72} />
          <span className="small muted">{comp.missing.length ? `${comp.missing.length} item${comp.missing.length > 1 ? 's' : ''} to fix` : 'Complete'}</span>
        </button>
      </header>

      {/* Context switch: global master vs. a market variant */}
      <div className="ctx-bar" role="group" aria-label="Choose global or market version">
        <span className="ctx-bar-label">Showing</span>
        <button className={`ctx-pill${!local ? ' on' : ''}`} onClick={() => setContext('global')}>
          <Globe2 size={15} /> Global master
        </button>
        <div className={`ctx-pill ctx-pill-select${local ? ' on' : ''}`}>
          <MapPin size={15} />
          <select value={local ? context : ''} onChange={(e) => e.target.value && setContext(e.target.value)} aria-label="Market version">
            <option value="" disabled>Market version…</option>
            <optgroup label="Markets for this product">
              {p.markets.map((m) => (
                <option key={m} value={m}>{marketLabel(m)} · {VARIANT_STATE_LABEL[variantState(p, m)]}</option>
              ))}
            </optgroup>
            {local && otherMarkets && <option value={context}>{marketLabel(context)} · not a target market</option>}
          </select>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          const n = t.group ? missingBy(t.group) : 0
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => navigate(`/products/${p.id}/${t.id}`, { replace: true })}>
              {t.label}
              {n > 0 && <span className="tab-count" title={`${n} missing or outdated`}>{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="product-layout">
        <div className="product-main">
          {tab === 'information' && <InfoTab p={p} user={user} context={context} />}
          {tab === 'marketing' && <MarketingTab p={p} user={user} context={context} />}
          {tab === 'assets' && <AssetsTab p={p} user={user} context={context} />}
          {tab === 'markets' && <MarketsTab p={p} user={user} />}
          {tab === 'history' && <HistoryTab p={p} user={user} />}
        </div>
        <SidePanel p={p} user={user} context={context} checks={comp.checks} />
      </div>
    </div>
  )
}
