import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Ban, ChevronRight, ClipboardCopy, Columns2, Download, FileDown, FileText } from 'lucide-react'
import { currentUser, setAvailability, setLocale, toast, useStore } from '../data/store'
import { GLOBAL, LIFECYCLE_LABEL, marketLabel } from '../data/reference'
import { can, essentialTodos, isAvailable, isReady, localeState } from '../data/rules'
import { copyText, downloadProductSheet, productAsText, productImage } from '../lib/files'
import { EmptyState, Menu, ReadyBadge, StatusBadge, UpdatedBy } from '../components/ui'
import { ApprovalActions } from '../components/approval'
import { LocaleCode, localeName } from '../components/Layout'
import { ContentTab, type ContentMode } from './product/ContentTab'
import { AssetsTab } from './product/AssetsTab'
import { LocalesTab } from './product/LocalesTab'
import { HistoryTab } from './product/HistoryTab'

export default function ProductPage() {
  const { id, tab = 'content' } = useParams()
  const [params, setParams] = useSearchParams()
  const product = useStore((s) => s.db.products.find((p) => p.id === id))
  const all = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const loc = useStore((s) => s.locale)
  const navigate = useNavigate()
  const mode: ContentMode = params.get('view') === 'side' ? 'side' : 'normal'
  const setMode = (m: ContentMode) => {
    const next = new URLSearchParams(params)
    if (m === 'side') next.set('view', 'side'); else next.delete('view')
    setParams(next, { replace: true })
    if (tab !== 'content') navigate(`/products/${id}${m === 'side' ? '?view=side' : ''}`)
  }

  // Links from the dashboard can name a locale: switch to it
  const wanted = params.get('locale')
  useEffect(() => {
    if (!wanted) return
    if (can.viewLocale(user, wanted)) setLocale(wanted)
    const next = new URLSearchParams(params)
    next.delete('locale')
    setParams(next, { replace: true })
  }, [wanted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Same product for other species: the product family
  const family = useMemo(() => (product ? all.filter((x) => x.name === product.name && x.id !== product.id && isAvailable(x, loc)) : []), [all, product, loc])

  if (!product) {
    return <div className="page"><EmptyState title="Product not found"><Link to="/products" className="btn btn-secondary">Back to products</Link></EmptyState></div>
  }
  const p = product
  const available = isAvailable(p, loc)
  const section = available ? loc : GLOBAL
  const meta = section === GLOBAL ? p.status : p.variants[section]?.meta
  const state = localeState(p, loc)
  const v = p.variants[section]
  const localAssets = p.assets.filter((a) => loc === GLOBAL || a.scope === GLOBAL || a.scope === loc).length
  const tabs = [
    { id: 'content', label: 'Content' },
    { id: 'assets', label: `Assets (${localAssets})` },
    { id: 'locales', label: `Locales (${p.markets.length})` },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="page product-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/products">Products</Link><ChevronRight size={14} />
        <Link to={`/products?range=${encodeURIComponent(p.range)}`}>{p.range}</Link><ChevronRight size={14} />
        <span>{p.name} – {p.species}</span>
      </nav>

      <header className="phead card">
        <img src={productImage(p)} alt="" className="phead-logo" />
        <div className="phead-main">
          <h1>{p.name} <span className="phead-species">– {p.species}</span></h1>
          <p className="phead-sub">{[p.range, ...p.stages, ...p.categories].filter(Boolean).join(' · ')}{p.lifecycle !== 'active' && ` · ${LIFECYCLE_LABEL[p.lifecycle]}`}</p>
          {family.length > 0 && (
            <p className="family small"><span className="muted">{p.name} is also made for</span>
              {family.map((f) => <Link key={f.id} to={`/products/${f.id}${mode === 'side' ? '?view=side' : ''}`} className="family-link">{f.species}</Link>)}
            </p>
          )}
        </div>
        <div className="phead-status">
          <div className="phead-loc">
            <LocaleCode id={loc} />
            <span>
              <strong>{loc === GLOBAL ? 'Global record' : localeName(loc)}</strong>
              <span className="row-gap wrap">
                {loc === GLOBAL && isReady(p) ? <ReadyBadge small /> : <StatusBadge status={state} small />}
                {loc === GLOBAL && essentialTodos(p).length > 0 && <span className="todo-count">{essentialTodos(p).length} missing</span>}
              </span>
            </span>
          </div>
          {meta && (
            <p className="muted small">
              {section === GLOBAL ? (p.content.version ? `Version ${p.content.version}` : 'Not approved yet') : v?.inheritsGlobal ? 'Uses the English text' : v?.version ? `Version ${v.version}` : 'Not approved yet'}
              {' · '}<UpdatedBy by={meta.updatedBy} at={meta.updatedAt} />
            </p>
          )}
          <div className="row-gap wrap end">
            {meta && <ApprovalActions p={p} section={section} meta={meta} user={user} />}
            <Menu
              label="Use"
              icon={<Download size={16} />}
              items={[
                { label: 'Copy all approved text', icon: <ClipboardCopy size={16} />, onClick: async () => toast((await copyText(productAsText(p, section))) ? 'Approved text copied' : 'Copy is blocked here', 'info') },
                { label: 'Download product sheet (PDF)', icon: <FileDown size={16} />, onClick: () => downloadProductSheet(p, section) },
              ]}
            />
          </div>
        </div>
      </header>

      {!available && (
        <div className="note note-warn">
          <Ban size={18} />
          <div className="grow"><strong>Not available in {localeName(loc)}.</strong> Showing the global record. {can.setAvailability(user) ? '' : 'The global team decides where a product is available.'}</div>
          {can.setAvailability(user) && <button className="btn btn-secondary btn-sm" onClick={() => setAvailability(p.id, loc, true)}>Make available in {localeName(loc)}</button>}
        </div>
      )}

      <div className="tabs-row">
        <div className="tabs" role="tablist">
          {tabs.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} className={`tab${tab === x.id ? ' on' : ''}`}
              onClick={() => navigate(x.id === 'content' ? `/products/${p.id}${mode === 'side' ? '?view=side' : ''}` : `/products/${p.id}/${x.id}`, { replace: true })}>
              {x.label}
            </button>
          ))}
        </div>
        {tab === 'content' && available && loc !== GLOBAL && (
          <div className="seg seg-text" role="group" aria-label="Layout">
            <button className={mode === 'normal' ? 'on' : ''} onClick={() => setMode('normal')}><FileText size={15} />Normal view</button>
            <button className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')} title={`Global English next to ${marketLabel(loc)}`}><Columns2 size={15} />Side by side</button>
          </div>
        )}
      </div>

      {tab === 'content' && <ContentTab p={p} user={user} loc={section} mode={mode} setMode={setMode} />}
      {tab === 'assets' && <AssetsTab p={p} user={user} loc={section} />}
      {tab === 'locales' && <LocalesTab p={p} user={user} onOpen={() => navigate(`/products/${p.id}`)} />}
      {tab === 'history' && <HistoryTab p={p} user={user} loc={section} />}
    </div>
  )
}
