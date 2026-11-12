import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Product } from '../types'
import { useStore } from '../data/store'
import { CATEGORIES, LANGUAGES, MARKETS, MARKET_BY_ID, STAGES, marketLabel } from '../data/reference'
import { MARKET_STATE_LABEL, TODO_AREA_LABEL, lastUpdated, marketState, todos, type MarketState, type TodoArea } from '../data/rules'
import { productImage } from '../lib/files'
import { timeAgo } from '../lib/format'
import { EmptyState, StatusBadge, Thumb } from '../components/ui'

type View = 'table' | 'grid'
function loadView(): View {
  try { return (localStorage.getItem('pim.view') as View) || 'grid' } catch { return 'grid' }
}

const STATUS_OPTIONS: [string, string][] = [['approved', 'Approved'], ['in_review', 'Waiting for approval'], ['draft', 'Draft']]
const MARKET_STATE_OPTIONS = (Object.keys(MARKET_STATE_LABEL) as MarketState[]).map((k) => [k, MARKET_STATE_LABEL[k]] as [string, string])
const TODO_OPTIONS: [string, string][] = [['any', 'Anything missing'], ['none', 'Nothing missing'], ...(Object.keys(TODO_AREA_LABEL) as TodoArea[]).map((k) => [k, `Missing ${TODO_AREA_LABEL[k].toLowerCase()}`] as [string, string])]

export default function Products() {
  const products = useStore((s) => s.db.products)
  const blobUrls = useStore((s) => s.blobUrls)
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(loadView)
  const [more, setMore] = useState(false)
  const get = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }
  const changeView = (v: View) => { setView(v); try { localStorage.setItem('pim.view', v) } catch { /* not available */ } }

  const ranges = useMemo(() => [...new Set(products.map((p) => p.range))].sort(), [products])
  const species = useMemo(() => [...new Set(products.map((p) => p.species))].sort(), [products])

  const rows = useMemo(() => {
    const terms = get('q').toLowerCase().split(/\s+/).filter(Boolean)
    const market = get('market')
    return products
      .map((p) => ({ p, t: todos(p) }))
      .filter(({ p, t }) => {
        if (terms.length) {
          const hay = [p.name, p.species, p.range, p.code, ...p.categories, p.content.tagline].join(' ').toLowerCase()
          if (!terms.every((x) => hay.includes(x))) return false
        }
        if (get('range') && p.range !== get('range')) return false
        if (get('species') && p.species !== get('species')) return false
        if (get('category') && !p.categories.includes(get('category'))) return false
        if (get('stage') && !p.stages.includes(get('stage'))) return false
        if (market && !p.markets.includes(market)) return false
        if (get('language') && !p.markets.some((l) => MARKET_BY_ID[l]?.language === get('language'))) return false
        if (get('status') && p.status.status !== get('status')) return false
        if (get('market_state')) {
          const locs = market ? [market] : p.markets
          if (!locs.some((l) => marketState(p, l) === get('market_state'))) return false
        }
        const todo = get('todo')
        if (todo === 'any' && !t.some((x) => x.area !== 'markets')) return false
        if (todo === 'none' && t.length) return false
        if (todo && todo !== 'any' && todo !== 'none' && !t.some((x) => x.area === todo)) return false
        return true
      })
      .sort((a, b) => {
        if (get('sort') === 'updated') return lastUpdated(b.p).localeCompare(lastUpdated(a.p))
        if (get('sort') === 'todo') return b.t.length - a.t.length
        return a.p.name.localeCompare(b.p.name) || a.p.species.localeCompare(b.p.species)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, params])

  const filterKeys = ['range', 'species', 'market', 'status', 'market_state', 'todo', 'category', 'stage', 'language']
  const active = filterKeys.filter((k) => get(k))
  const clearAll = () => setParams(get('q') ? new URLSearchParams({ q: get('q') }) : new URLSearchParams(), { replace: true })
  const chipLabel = (k: string, v: string) => {
    if (k === 'market') return marketLabel(v)
    if (k === 'status') return STATUS_OPTIONS.find((o) => o[0] === v)?.[1] ?? v
    if (k === 'market_state') return `Translation: ${MARKET_STATE_LABEL[v as MarketState].toLowerCase()}`
    if (k === 'todo') return TODO_OPTIONS.find((o) => o[0] === v)?.[1] ?? v
    return v
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted">{rows.length === products.length ? `${products.length} products` : `${rows.length} of ${products.length} products`}</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden />
          <input id="product-search" type="search" placeholder="Search by name, species, range or code" value={get('q')} onChange={(e) => set('q', e.target.value)} aria-label="Search products" />
        </label>
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => changeView('grid')} aria-label="Cards"><LayoutGrid size={18} /></button>
          <button className={view === 'table' ? 'on' : ''} onClick={() => changeView('table')} aria-label="List"><List size={18} /></button>
        </div>
      </div>

      <div className="filters">
        <Select id="f-range" label="Range" value={get('range')} onChange={(v) => set('range', v)} options={ranges} />
        <Select id="f-species" label="Species" value={get('species')} onChange={(v) => set('species', v)} options={species} />
        <Select id="f-market" label="Market" value={get('market')} onChange={(v) => set('market', v)} options={MARKETS.map((m) => [m.id, marketLabel(m.id)])} />
        <Select id="f-status" label="Status" value={get('status')} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
        <Select id="f-todo" label="Missing information" value={get('todo')} onChange={(v) => set('todo', v)} options={TODO_OPTIONS} />
        <button className={`btn btn-ghost more-btn${more ? ' on' : ''}`} onClick={() => setMore(!more)}><SlidersHorizontal size={16} />More filters</button>
        {more && (
          <>
            <Select id="f-translation" label="Translation status" value={get('market_state')} onChange={(v) => set('market_state', v)} options={MARKET_STATE_OPTIONS} />
            <Select id="f-category" label="Category" value={get('category')} onChange={(v) => set('category', v)} options={CATEGORIES} />
            <Select id="f-stage" label="Stage" value={get('stage')} onChange={(v) => set('stage', v)} options={STAGES} />
            <Select id="f-language" label="Language" value={get('language')} onChange={(v) => set('language', v)} options={LANGUAGES} />
            <Select id="f-sort" label="Sort by" value={get('sort')} onChange={(v) => set('sort', v)} options={[['', 'Name'], ['updated', 'Recently updated'], ['todo', 'Most to do']]} noAll />
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
          <p className="muted">Try another search or clear the filters.</p>
          <button className="btn btn-secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear search and filters</button>
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid">
          {rows.map(({ p, t }) => (
            <Link key={p.id} to={`/products/${p.id}`} className="pcard">
              <div className="pcard-img"><img src={productImage(p, blobUrls)} alt="" /></div>
              <div className="pcard-body">
                <strong className="pcard-name">{p.name}</strong>
                <span className="muted small">{p.species} · {p.range}</span>
                <div className="pcard-foot">
                  <StatusBadge status={p.status.status} small />
                  <TodoCount t={t.length} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th className="hide-md">Translations</th>
                <th className="hide-md">To do</th>
                <th className="hide-lg">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, t }) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/products/${p.id}`} className="prod-cell">
                      <Thumb url={productImage(p, blobUrls)} size={40} />
                      <span>
                        <strong>{p.name} – {p.species}</strong>
                        <span className="muted small block">{p.range}{p.categories.length ? ` · ${p.categories.join(', ')}` : ''}</span>
                      </span>
                    </Link>
                  </td>
                  <td><StatusBadge status={p.status.status} small /></td>
                  <td className="hide-md"><TranslationSummary p={p} /></td>
                  <td className="hide-md"><TodoCount t={t.length} /></td>
                  <td className="hide-lg small muted nowrap">{timeAgo(lastUpdated(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function TodoCount({ t }: { t: number }) {
  return t ? <span className="todo-count">{t} to do</span> : <span className="done-count">Complete</span>
}

export function TranslationSummary({ p }: { p: Product }) {
  if (!p.markets.length) return <span className="empty-value">No markets</span>
  const states = p.markets.map((l) => marketState(p, l))
  const approved = states.filter((s) => s === 'approved').length
  const update = states.filter((s) => s === 'needs_update').length
  const notStarted = states.filter((s) => s === 'not_started').length
  return (
    <span className="small">
      {approved} of {p.markets.length} approved
      {update > 0 && <span className="warn-text block">{update} to update</span>}
      {notStarted > 0 && <span className="muted block">{notStarted} not started</span>}
    </span>
  )
}
