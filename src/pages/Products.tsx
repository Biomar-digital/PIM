import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, LayoutGrid, List, Search, SlidersHorizontal, Table2, Upload, X } from 'lucide-react'
import type { Product } from '../types'
import { currentUser, useStore } from '../data/store'
import { CATEGORIES, LANGUAGES, MARKETS, MARKET_BY_ID, STAGES, marketLabel } from '../data/reference'
import { can, MARKET_STATE_LABEL, TODO_AREA_LABEL, isReady, lastUpdated, marketState, todos, type MarketState, type TodoArea } from '../data/rules'
import { productImage } from '../lib/files'
import { timeAgo } from '../lib/format'
import { EmptyState, ReadyBadge, StatusBadge, Thumb } from '../components/ui'
import { Sheet } from '../components/Sheet'
import { ImportModal } from '../components/ImportModal'
import { exportProducts } from '../lib/excel'

type View = 'table' | 'grid' | 'sheet'
function loadView(): View {
  try { return (localStorage.getItem('pim.view') as View) || 'table' } catch { return 'table' }
}

const STATUS_OPTIONS: [string, string][] = [['ready', 'Ready to use'], ['approved', 'Approved'], ['in_review', 'In approval'], ['draft', 'Draft']]
const MARKET_STATE_OPTIONS = (Object.keys(MARKET_STATE_LABEL) as MarketState[]).map((k) => [k, MARKET_STATE_LABEL[k]] as [string, string])
const TODO_OPTIONS: [string, string][] = [
  ['any', 'Something essential missing'], ['none', 'Nothing essential missing'],
  ...(Object.keys(TODO_AREA_LABEL) as TodoArea[]).map((k) => [k, `Missing ${TODO_AREA_LABEL[k].toLowerCase()}`] as [string, string]),
]

export default function Products() {
  const products = useStore((s) => s.db.products)
  const blobUrls = useStore((s) => s.blobUrls)
  const user = useStore(currentUser)
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(loadView)
  const [more, setMore] = useState(false)
  const [importing, setImporting] = useState(false)
  const users = useStore((s) => s.db.users)
  const get = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }
  const changeView = (v: View) => { setView(v); try { localStorage.setItem('pim.view', v) } catch { /* not available */ } }

  // Local editors see their own markets first
  const hasMarkets = user.markets.length > 0
  const onlyMine = hasMarkets && get('scope') !== 'all'
  const mineCount = useMemo(() => products.filter((p) => p.markets.some((m) => user.markets.includes(m))).length, [products, user])

  const ranges = useMemo(() => [...new Set(products.map((p) => p.range))].sort(), [products])
  const species = useMemo(() => [...new Set(products.map((p) => p.species))].sort(), [products])

  const rows = useMemo(() => {
    const terms = get('q').toLowerCase().split(/\s+/).filter(Boolean)
    const market = get('market')
    return products
      .map((p) => {
        const t = todos(p)
        return { p, t, essential: t.filter((x) => x.essential).length }
      })
      .filter(({ p, t, essential }) => {
        if (onlyMine && !p.markets.some((m) => user.markets.includes(m))) return false
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
        const status = get('status')
        if (status === 'ready' && !isReady(p)) return false
        if (status && status !== 'ready' && p.status.status !== status) return false
        if (get('market_state')) {
          const locs = market ? [market] : onlyMine ? p.markets.filter((m) => user.markets.includes(m)) : p.markets
          if (!locs.some((l) => marketState(p, l) === get('market_state'))) return false
        }
        const todo = get('todo')
        if (todo === 'any' && !essential) return false
        if (todo === 'none' && essential) return false
        if (todo && todo !== 'any' && todo !== 'none' && !t.some((x) => x.area === todo)) return false
        return true
      })
      .sort((a, b) => {
        if (get('sort') === 'updated') return lastUpdated(b.p).localeCompare(lastUpdated(a.p))
        if (get('sort') === 'todo') return b.essential - a.essential
        return a.p.range.localeCompare(b.p.range) || a.p.name.localeCompare(b.p.name) || a.p.species.localeCompare(b.p.species)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, params, user])

  // Group by range when sorted by name (the default)
  const grouped = !get('sort')
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>()
    for (const r of rows) map.set(r.p.range, [...(map.get(r.p.range) ?? []), r])
    return [...map.entries()]
  }, [rows])

  const filterKeys = ['range', 'species', 'market', 'status', 'market_state', 'todo', 'category', 'stage', 'language']
  const active = filterKeys.filter((k) => get(k))
  const clearAll = () => {
    const keep = new URLSearchParams()
    if (get('q')) keep.set('q', get('q'))
    if (get('scope')) keep.set('scope', get('scope'))
    setParams(keep, { replace: true })
  }
  const chipLabel = (k: string, v: string) => {
    if (k === 'market') return marketLabel(v)
    if (k === 'status') return STATUS_OPTIONS.find((o) => o[0] === v)?.[1] ?? v
    if (k === 'market_state') return `Translation: ${MARKET_STATE_LABEL[v as MarketState].toLowerCase()}`
    if (k === 'todo') return TODO_OPTIONS.find((o) => o[0] === v)?.[1] ?? v
    return v
  }

  const card = ({ p, essential }: (typeof rows)[number]) => (
    <Link key={p.id} to={`/products/${p.id}`} className="pcard">
      <div className="pcard-img"><img src={productImage(p, blobUrls)} alt="" /></div>
      <div className="pcard-body">
        <strong className="pcard-name">{p.name}</strong>
        <span className="muted small">{p.species}</span>
        <div className="pcard-foot">
          {isReady(p) ? <ReadyBadge small /> : <StatusBadge status={p.status.status} small />}
          <MissingCount n={essential} />
        </div>
      </div>
    </Link>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted">{rows.length} {rows.length === 1 ? 'product' : 'products'}{onlyMine ? ` sold in your markets (${user.markets.map((m) => marketLabel(m, true)).join(', ')})` : ''}</p>
        </div>
        <div className="row-gap wrap">
          <button className="btn btn-secondary" onClick={() => exportProducts(rows.map((r) => r.p), users)} title="Download the products shown below as an Excel file"><Download size={16} />Export to Excel</button>
          {can.editGlobal(user) && <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload size={16} />Import from Excel</button>}
        </div>
      </div>
      {hasMarkets && (
        <div className="scope-row">
          <div className="seg seg-text" role="group" aria-label="Which products">
            <button className={onlyMine ? 'on' : ''} onClick={() => set('scope', '')}>Your markets ({mineCount})</button>
            <button className={!onlyMine ? 'on' : ''} onClick={() => set('scope', 'all')}>All products ({products.length})</button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden />
          <input id="product-search" type="search" placeholder="Search by name, species, range or code" value={get('q')} onChange={(e) => set('q', e.target.value)} aria-label="Search products" />
        </label>
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'table' ? 'on' : ''} onClick={() => changeView('table')} title="List"><List size={18} /><span className="hide-sm">List</span></button>
          <button className={view === 'grid' ? 'on' : ''} onClick={() => changeView('grid')} title="Cards"><LayoutGrid size={18} /><span className="hide-sm">Cards</span></button>
          <button className={view === 'sheet' ? 'on' : ''} onClick={() => changeView('sheet')} title="Spreadsheet: edit many products at once"><Table2 size={18} /><span className="hide-sm">Spreadsheet</span></button>
        </div>
      </div>

      <div className="filters">
        <Select id="f-range" label="Range" value={get('range')} onChange={(v) => set('range', v)} options={ranges} />
        <Select id="f-species" label="Species" value={get('species')} onChange={(v) => set('species', v)} options={species} />
        <Select id="f-market" label="Market" value={get('market')} onChange={(v) => set('market', v)} options={(onlyMine ? MARKETS.filter((m) => user.markets.includes(m.id)) : MARKETS).map((m) => [m.id, marketLabel(m.id)])} />
        <Select id="f-status" label="Status" value={get('status')} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
        <Select id="f-translation" label="Translation" value={get('market_state')} onChange={(v) => set('market_state', v)} options={MARKET_STATE_OPTIONS} />
        <button className={`btn btn-ghost more-btn${more ? ' on' : ''}`} onClick={() => setMore(!more)}><SlidersHorizontal size={16} />More filters</button>
        {more && (
          <>
            <Select id="f-todo" label="Missing information" value={get('todo')} onChange={(v) => set('todo', v)} options={TODO_OPTIONS} />
            <Select id="f-category" label="Category" value={get('category')} onChange={(v) => set('category', v)} options={CATEGORIES} />
            <Select id="f-stage" label="Stage" value={get('stage')} onChange={(v) => set('stage', v)} options={STAGES} />
            <Select id="f-language" label="Language" value={get('language')} onChange={(v) => set('language', v)} options={LANGUAGES} />
            <Select id="f-sort" label="Sort by" value={get('sort')} onChange={(v) => set('sort', v)} options={[['', 'Range'], ['updated', 'Recently updated'], ['todo', 'Most missing']]} noAll />
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
      ) : view === 'sheet' ? (
        <Sheet products={rows.map((r) => r.p)} users={users} canEdit={can.editGlobal(user)} />
      ) : view === 'grid' ? (
        grouped ? (
          <div className="range-groups">
            {groups.map(([range, items]) => (
              <section key={range} className="range-group">
                <h2 className="range-head">{range}<span className="muted small">{items.length}</span></h2>
                <div className="grid">{items.map(card)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid">{rows.map(card)}</div>
        )
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th className="hide-md">Translations</th>
                <th className="hide-md">Missing</th>
                <th className="hide-lg">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(grouped ? groups : [['', rows] as [string, typeof rows]]).map(([range, items]) => (
                <Fragment key={range || 'all'}>
                  {range && <tr className="group-row"><td colSpan={5}>{range}</td></tr>}
                  {items.map(({ p, essential }) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/products/${p.id}`} className="prod-cell">
                          <Thumb url={productImage(p, blobUrls)} size={40} />
                          <span>
                            <strong>{p.name} – {p.species}</strong>
                            <span className="muted small block">{p.categories.join(', ') || p.range}</span>
                          </span>
                        </Link>
                      </td>
                      <td>{isReady(p) ? <ReadyBadge small /> : <StatusBadge status={p.status.status} small />}</td>
                      <td className="hide-md"><TranslationSummary p={p} only={onlyMine ? user.markets : undefined} /></td>
                      <td className="hide-md"><MissingCount n={essential} /></td>
                      <td className="hide-lg small muted nowrap">{timeAgo(lastUpdated(p))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {importing && <ImportModal products={products} users={users} onClose={() => setImporting(false)} />}
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

/** Count of essential items still missing (copy, packshot, datasheet) */
function MissingCount({ n }: { n: number }) {
  return n ? <span className="todo-count" title="Essential items missing: marketing copy, packshot or datasheet">{n} missing</span> : null
}

export function TranslationSummary({ p, only }: { p: Product; only?: string[] }) {
  const markets = only ? p.markets.filter((m) => only.includes(m)) : p.markets
  if (!markets.length) return <span className="empty-value">No markets</span>
  const states = markets.map((l) => marketState(p, l))
  const approved = states.filter((s) => s === 'approved').length
  const update = states.filter((s) => s === 'needs_update').length
  const notStarted = states.filter((s) => s === 'not_started').length
  return (
    <span className="small">
      {approved} of {markets.length} approved
      {update > 0 && <span className="warn-text block">{update} to update</span>}
      {notStarted > 0 && <span className="muted block">{notStarted} not started</span>}
    </span>
  )
}
