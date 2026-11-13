import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Ban, ChevronRight, ClipboardCopy, Columns2, Download, FileDown, FileText } from 'lucide-react'
import { currentUser, setAvailability, setLocale, toast, useStore } from '../data/store'
import { GLOBAL, LIFECYCLE_LABEL, isGroup, marketLabel, scopeLocales } from '../data/reference'
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
  const scope = useStore((s) => s.locale)
  const navigate = useNavigate()
  // In a region, the page works on one of its markets at a time (switch with the market tabs)
  const regionMarkets = isGroup(scope) ? scopeLocales(scope) : null
  const chosen = params.get('market') ?? ''
  const loc = regionMarkets
    ? (regionMarkets.includes(chosen) ? chosen : regionMarkets.find((l) => product?.markets.includes(l)) ?? regionMarkets[0])
    : scope
  /** Keep the chosen market (and the side-by-side view on the content tab) when moving between tabs */
  const keep = (content: boolean) => {
    const q = new URLSearchParams()
    if (regionMarkets) q.set('market', loc)
    if (content && params.get('view') === 'side') q.set('view', 'side')
    const t = q.toString()
    return t ? `?${t}` : ''
  }
  const setMarket = (m: string) => {
    const next = new URLSearchParams(params)
    next.set('market', m)
    setParams(next, { replace: true })
  }
  const mode: ContentMode = params.get('view') === 'side' ? 'side' : 'normal'
  const setMode = (m: ContentMode) => {
    const next = new URLSearchParams(params)
    if (m === 'side') next.set('view', 'side'); else next.delete('view')
    setParams(next, { replace: true })
    if (tab !== 'content') navigate(`/products/${id}?${regionMarkets ? `market=${loc}&` : ''}${m === 'side' ? 'view=side' : ''}`)
  }

  // Links from the dashboard can name a locale: switch to it
  const wanted = params.get('locale')
  useEffect(() => {
    if (!wanted) return
    const next = new URLSearchParams(params)
    if (regionMarkets?.includes(wanted)) next.set('market', wanted)
    else if (can.viewLocale(user, wanted)) setLocale(wanted)
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
              {family.map((f) => <Link key={f.id} to={`/products/${f.id}${keep(true)}`} className="family-link">{f.species}</Link>)}
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

      {regionMarkets && (
        <div className="market-tabs" role="tablist" aria-label={`Markets in ${localeName(scope)}`}>
          <span className="muted small">{localeName(scope)}:</span>
          {regionMarkets.map((m) => {
            const st = localeState(p, m)
            return (
              <button key={m} role="tab" aria-selected={m === loc} className={`market-tab${m === loc ? ' on' : ''}${st === 'not_available' ? ' off' : ''}`} onClick={() => setMarket(m)} title={`${marketLabel(m)}: ${st === 'not_available' ? 'not available' : st.replace('_', ' ')}`}>
                <span className={`dot dot-${st}`} />{localeName(m)}
              </button>
            )
          })}
        </div>
      )}

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
              onClick={() => navigate(`/products/${p.id}${x.id === 'content' ? '' : `/${x.id}`}${keep(x.id === 'content')}`, { replace: true })}>
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
      {tab === 'locales' && <LocalesTab p={p} user={user} onOpen={(l) => navigate(`/products/${p.id}${regionMarkets?.includes(l) ? `?market=${l}` : ''}`)} />}
      {tab === 'history' && <HistoryTab p={p} user={user} loc={section} />}
    </div>
  )
}
