import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, LayoutGrid, List, Search, SlidersHorizontal, Table2, Upload, X } from 'lucide-react'
import type { Product } from '../types'
import { currentUser, useStore, userName } from '../data/store'
import { CATEGORIES, GLOBAL, MARKETS, STAGES, isGroup, marketLabel, scopeLocales } from '../data/reference'
import { can, essentialTodos, isReady, lastUpdated, localeState, LOCALE_STATE_LABEL, type LocaleState } from '../data/rules'
import { ATTENTION_LABEL, marketsIn, matches, productsIn, type Attention } from '../data/insights'
import { heroImage, productImage } from '../lib/files'
import { SpeciesIcon } from '../components/ui'
import { timeAgo } from '../lib/format'
import { EmptyState, ReadyBadge, StatusBadge, Thumb } from '../components/ui'
import { Sheet } from '../components/Sheet'
import { ImportModal } from '../components/ImportModal'
import { exportProducts } from '../lib/excel'
import { LocaleCode, localeName } from '../components/Layout'
import { localeCode as localeCodeOf } from '../data/reference'

type View = 'table' | 'grid' | 'sheet'
function loadView(): View {
  try { return (localStorage.getItem('pim.view') as View) || 'table' } catch { return 'table' }
}

const LOCAL_STATES: LocaleState[] = ['approved', 'needs_review', 'in_review', 'draft', 'missing']
const GLOBAL_STATES: [string, string][] = [['ready', 'Ready to use'], ['approved', 'Approved'], ['in_review', 'In approval'], ['draft', 'Draft']]

export default function Products() {
  const all = useStore((s) => s.db.products)
  const users = useStore((s) => s.db.users)
  const user = useStore(currentUser)
  const loc = useStore((s) => s.locale)
  const global = loc === GLOBAL
  const group = isGroup(loc)
  const products = useMemo(() => productsIn(all, loc), [all, loc])
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(loadView)
  const [more, setMore] = useState(false)
  const [importing, setImporting] = useState(false)
  const get = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }
  const changeView = (v: View) => { setView(v); try { localStorage.setItem('pim.view', v) } catch { /* not available */ } }
  const canSheet = global && can.editGlobal(user)
  const shownView: View = view === 'sheet' && !canSheet ? 'table' : view

  const ranges = useMemo(() => [...new Set(products.map((p) => p.range))].sort(), [products])
  const species = useMemo(() => [...new Set(products.map((p) => p.species))].sort(), [products])

  const rows = useMemo(() => {
    const terms = get('q').toLowerCase().split(/\s+/).filter(Boolean)
    const status = get('status')
    const show = get('show') as Attention | ''
    // In a region, the market filter narrows everything to one of its markets
    const scope = group && get('market') && scopeLocales(loc).includes(get('market')) ? get('market') : loc
    return productsIn(products, scope)
      .filter((p) => {
        if (terms.length) {
          const hay = [p.name, p.species, p.range, p.code, ...p.categories, ...p.stages].join(' ').toLowerCase()
          if (!terms.every((x) => hay.includes(x))) return false
        }
        if (get('range') && p.range !== get('range')) return false
        if (get('species') && p.species !== get('species')) return false
        if (get('stage') && !p.stages.includes(get('stage'))) return false
        if (get('category') && !p.categories.includes(get('category'))) return false
        if (global && get('market') && !p.markets.includes(get('market'))) return false
        if (status === 'ready' && !isReady(p)) return false
        if (status && status !== 'ready' && !(global ? [GLOBAL] : marketsIn(p, scope)).some((l) => localeState(p, l) === status)) return false
        if (show && !matches(p, scope, show)) return false
        return true
      })
      .sort((a, b) => {
        if (get('sort') === 'updated') return lastUpdated(b, loc).at.localeCompare(lastUpdated(a, loc).at)
        return a.range.localeCompare(b.range) || a.name.localeCompare(b.name) || a.species.localeCompare(b.species)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, params, loc])

  // Range > product > species. Grouped when sorted by range (the default).
  const grouped = !get('sort')
  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of rows) map.set(p.range, [...(map.get(p.range) ?? []), p])
    return [...map.entries()]
  }, [rows])

  const filterKeys = ['show', 'range', 'species', 'stage', 'status', 'category', 'market']
  const active = filterKeys.filter((k) => get(k))
  const clearAll = () => {
    const keep = new URLSearchParams()
    if (get('q')) keep.set('q', get('q'))
    setParams(keep, { replace: true })
  }
  const chipLabel = (k: string, v: string) => {
    if (k === 'show') return ATTENTION_LABEL[v as Attention] ?? v
    if (k === 'market') return `Available in ${marketLabel(v, true)}`
    if (k === 'status') return v === 'ready' ? 'Ready to use' : LOCALE_STATE_LABEL[v as LocaleState]
    return v
  }

  const card = (p: Product) => (
    <Link key={p.id} to={`/products/${p.id}`} className="pcard">
      <div className="pcard-img">
        <img src={heroImage(p)?.url ?? productImage(p)} alt="" className={heroImage(p) ? 'pack' : 'logo'} />
      </div>
      <div className="pcard-body">
        <img src={productImage(p)} alt="" className="pcard-logo" />
        <strong className="pcard-name">{p.name}</strong>
        <span className="species-cell small"><SpeciesIcon name={p.species} />{p.species}<span className="muted"> · {p.stages.join(', ')}</span></span>
        <div className="pcard-foot">
          <LocaleStatus p={p} loc={loc} />
        </div>
      </div>
    </Link>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted row-gap wrap">
            <LocaleCode id={loc} />
            {global ? `${rows.length} of ${products.length} products` : `${rows.length} of ${products.length} products available in ${localeName(loc)}`}
            {group && <span className="muted small">({scopeLocales(loc).map((l) => marketLabel(l, true)).join(', ')})</span>}
          </p>
        </div>
        <div className="row-gap wrap">
          <button className="btn btn-secondary" onClick={() => exportProducts(rows, users)} title="Download the products shown below as an Excel file"><Download size={16} />Export to Excel</button>
          {can.editGlobal(user) && global && <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload size={16} />Import from Excel</button>}
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden />
          <input id="product-search" type="search" placeholder="Search by product name, species, range or code" value={get('q')} onChange={(e) => set('q', e.target.value)} aria-label="Search products" />
        </label>
        <div className="seg" role="group" aria-label="View">
          <button className={shownView === 'table' ? 'on' : ''} onClick={() => changeView('table')} title="List"><List size={18} /><span className="hide-sm">List</span></button>
          <button className={shownView === 'grid' ? 'on' : ''} onClick={() => changeView('grid')} title="Cards"><LayoutGrid size={18} /><span className="hide-sm">Cards</span></button>
          {canSheet && <button className={shownView === 'sheet' ? 'on' : ''} onClick={() => changeView('sheet')} title="Spreadsheet: edit the global record of many products at once"><Table2 size={18} /><span className="hide-sm">Spreadsheet</span></button>}
        </div>
      </div>

      <div className="filters">
        <Select id="f-range" label="Range" value={get('range')} onChange={(v) => set('range', v)} options={ranges} />
        <Select id="f-species" label="Species" value={get('species')} onChange={(v) => set('species', v)} options={species} />
        <Select id="f-stage" label="Production stage" value={get('stage')} onChange={(v) => set('stage', v)} options={STAGES} />
        <Select id="f-status" label={global ? 'Global status' : group ? 'Status in any market' : `Status in ${localeName(loc)}`} value={get('status')} onChange={(v) => set('status', v)}
          options={global ? GLOBAL_STATES : LOCAL_STATES.map((s) => [s, LOCALE_STATE_LABEL[s]])} />
        {(global || group) && <Select id="f-market" label={global ? 'Available in' : 'Market'} value={get('market')} onChange={(v) => set('market', v)} options={(global ? MARKETS.map((m) => m.id) : scopeLocales(loc)).map((m) => [m, marketLabel(m)])} />}
        <button className={`btn btn-ghost more-btn${more ? ' on' : ''}`} onClick={() => setMore(!more)}><SlidersHorizontal size={16} />More</button>
        {more && (
          <>
            <Select id="f-show" label="Needs attention" value={get('show')} onChange={(v) => set('show', v)} options={(Object.keys(ATTENTION_LABEL) as Attention[]).map((a) => [a, ATTENTION_LABEL[a]])} />
            <Select id="f-category" label="Category" value={get('category')} onChange={(v) => set('category', v)} options={CATEGORIES} />
            <Select id="f-sort" label="Sort by" value={get('sort')} onChange={(v) => set('sort', v)} options={[['', 'Range and name'], ['updated', 'Recently updated']]} noAll />
          </>
        )}
      </div>

      {active.length > 0 && (
        <div className="chips">
          {active.map((k) => (
            <button key={k} className="chip" onClick={() => set(k, '')}>{chipLabel(k, get(k))}<X size={14} aria-label="Remove filter" /></button>
          ))}
          <button className="link-btn" onClick={clearAll}>Clear filters</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Search size={32} />} title="No products found">
          <p className="muted">{products.length === 0 ? `No products are available in ${localeName(loc)} yet.` : 'Try another search or clear the filters.'}</p>
          {products.length > 0 && <button className="btn btn-secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear search and filters</button>}
        </EmptyState>
      ) : shownView === 'sheet' ? (
        <Sheet products={rows} users={users} canEdit={can.editGlobal(user)} />
      ) : shownView === 'grid' ? (
        <div className="range-groups">
          {(grouped ? groups : [['', rows] as [string, Product[]]]).map(([range, items]) => (
            <section key={range || 'all'} className="range-group">
              {range && <h2 className="range-head">{range}<span className="muted small">{items.length}</span></h2>}
              <div className="grid">{items.map(card)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="table products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Species</th>
                <th className="hide-md">Production stage</th>
                <th>{global ? 'Global status' : group ? 'Status per market' : `Status in ${localeName(loc)}`}</th>
                {global && <th className="hide-md">Locales</th>}
                <th className="hide-lg">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {(grouped ? groups : [['', rows] as [string, Product[]]]).map(([range, items]) => (
                <Fragment key={range || 'all'}>
                  {range && <tr className="group-row"><td colSpan={global ? 6 : 5}>{range} <span className="muted">{items.length}</span></td></tr>}
                  {items.map((p, i) => {
                    const sameFamily = grouped && i > 0 && items[i - 1].name === p.name
                    const upd = lastUpdated(p, loc)
                    return (
                      <tr key={p.id} className={sameFamily ? 'family-row' : ''}>
                        <td>
                          <Link to={`/products/${p.id}`} className="prod-cell">
                            {sameFamily ? <span className="family-indent" aria-hidden /> : <Thumb url={productImage(p)} size={40} />}
                            <span><strong className={sameFamily ? 'muted' : ''}>{p.name}</strong></span>
                          </Link>
                        </td>
                        <td><Link to={`/products/${p.id}`} className="plain-link species-cell"><SpeciesIcon name={p.species} />{p.species}</Link></td>
                        <td className="hide-md small">{p.stages.join(', ')}</td>
                        <td><LocaleStatus p={p} loc={loc} /></td>
                        {global && <td className="hide-md"><LocalesSummary p={p} /></td>}
                        <td className="hide-lg small muted nowrap" title={userName(upd.by)}>{timeAgo(upd.at)}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {importing && <ImportModal products={all} users={users} onClose={() => setImporting(false)} />}
    </div>
  )
}

function Select({ id, label, value, onChange, options, noAll }: { id: string; label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[]; noAll?: boolean }) {
  return (
    <label className={`filter${value ? ' set' : ''}`}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {!noAll && <option value="">All</option>}
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o]
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </label>
  )
}

/** Status of the product in the selected locale, plus what is missing */
function LocaleStatus({ p, loc }: { p: Product; loc: string }) {
  if (isGroup(loc)) return <MarketChips p={p} loc={loc} />
  const missing = essentialTodos(p).length
  return (
    <span className="status-cell">
      {loc === GLOBAL && isReady(p) ? <ReadyBadge small /> : <StatusBadge status={localeState(p, loc)} small />}
      {loc === GLOBAL && missing > 0 && <span className="todo-count" title={essentialTodos(p).map((t) => t.label).join(', ')}>{missing} missing</span>}
    </span>
  )
}

/** Local versions at a glance (Global view) */
function LocalesSummary({ p }: { p: Product }) {
  if (!p.markets.length) return <span className="empty-value">Not in any locale</span>
  const states = p.markets.map((l) => localeState(p, l))
  const approved = states.filter((s) => s === 'approved').length
  const review = states.filter((s) => s === 'needs_review').length
  const missing = states.filter((s) => s === 'missing').length
  return (
    <span className="small">
      {approved} of {p.markets.length} approved
      {review > 0 && <span className="warn-text block">{review} to review</span>}
      {missing > 0 && <span className="muted block">{missing} not started</span>}
    </span>
  )
}

/** One small chip per market of the region where the product is available, coloured by its status */
function MarketChips({ p, loc }: { p: Product; loc: string }) {
  return (
    <span className="market-chips">
      {marketsIn(p, loc).map((l) => {
        const st = localeState(p, l)
        return <span key={l} className={`mchip mchip-${st}`} title={`${marketLabel(l)}: ${LOCALE_STATE_LABEL[st]}`}><span className={`dot dot-${st}`} />{localeCodeOf(l)}</span>
      })}
    </span>
  )
}
