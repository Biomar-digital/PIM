import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Product } from '../types'
import { useStore } from '../data/store'
import { CATEGORIES, LANGUAGES, MARKETS, MARKET_BY_ID, STAGES, marketLabel } from '../data/reference'
import { VARIANT_STATE_LABEL, completeness, lastUpdated, overallStatus, variantState } from '../data/rules'
import { hasHero, productThumb } from '../lib/artwork'
import { timeAgo } from '../lib/format'
import { CompletenessBar, EmptyState, StatusBadge, Thumb } from '../components/ui'

type View = 'table' | 'grid'
function loadView(): View {
  try { return (localStorage.getItem('pim.view') as View) || 'table' } catch { return 'table' }
}

const ISSUES: Record<string, string> = { info: 'Product information', marketing: 'Marketing content', assets: 'Required assets', markets: 'Local versions' }

export default function Library() {
  const products = useStore((s) => s.db.products)
  const context = useStore((s) => s.context)
  const blobUrls = useStore((s) => s.blobUrls)
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(loadView)
  const [showFilters, setShowFilters] = useState(false)
  const get = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }
  const changeView = (v: View) => { setView(v); try { localStorage.setItem('pim.view', v) } catch { /* ignore */ } }

  const local = context !== 'global'
  const showAll = get('all') === '1'

  const options = useMemo(() => ({
    ranges: [...new Set(products.map((p) => p.range))].sort(),
    species: [...new Set(products.map((p) => p.species))].sort(),
  }), [products])

  const rows = useMemo(() => {
    const q = get('q').toLowerCase()
    return products
      .filter((p) => !local || showAll || p.markets.includes(context))
      .map((p) => ({ p, c: completeness(p) }))
      .filter(({ p, c }) => {
        if (q) {
          const hay = [p.name, p.species, p.range, p.code, p.category, p.marketing.tagline, p.marketing.shortDescription].join(' ').toLowerCase()
          if (!q.split(/\s+/).every((t) => hay.includes(t))) return false
        }
        if (get('range') && p.range !== get('range')) return false
        if (get('species') && p.species !== get('species')) return false
        if (get('category') && p.category !== get('category')) return false
        if (get('stage') && !p.stages.includes(get('stage'))) return false
        if (get('market') && !p.markets.includes(get('market'))) return false
        if (get('language') && !Object.keys(p.variants).some((l) => MARKET_BY_ID[l]?.language === get('language'))) return false
        if (get('status')) {
          const st = local ? variantState(p, context) : overallStatus(p)
          if (st !== get('status')) return false
        }
        if (get('state')) {
          const locs = local ? [context] : p.markets
          if (!locs.some((l) => variantState(p, l) === get('state'))) return false
        }
        if (get('issue') && !c.missing.some((m) => m.group === get('issue'))) return false
        if (get('complete') === 'yes' && c.score < 100) return false
        if (get('complete') === 'no' && c.score === 100) return false
        return true
      })
      .sort((a, b) => {
        const s = get('sort') || 'name'
        if (s === 'completeness') return a.c.score - b.c.score
        if (s === 'updated') return lastUpdated(b.p).localeCompare(lastUpdated(a.p))
        return a.p.name.localeCompare(b.p.name) || a.p.species.localeCompare(b.p.species)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, params, context])

  const filterKeys = ['range', 'species', 'category', 'stage', 'market', 'language', 'status', 'state', 'issue', 'complete']
  const active = filterKeys.filter((k) => get(k))
  const clearAll = () => {
    const next = new URLSearchParams()
    if (get('q')) next.set('q', get('q'))
    setParams(next, { replace: true })
  }
  const chipLabel = (k: string, v: string) => {
    if (k === 'market') return `Market: ${marketLabel(v, true)}`
    if (k === 'status') return `Status: ${VARIANT_STATE_LABEL[v as keyof typeof VARIANT_STATE_LABEL] ?? v}`
    if (k === 'state') return `Has ${VARIANT_STATE_LABEL[v as keyof typeof VARIANT_STATE_LABEL].toLowerCase()} local versions`
    if (k === 'issue') return `Missing: ${ISSUES[v]}`
    if (k === 'complete') return v === 'yes' ? 'Complete' : 'Incomplete'
    return v
  }

  const selects = (
    <>
      <Select label="Product range" value={get('range')} onChange={(v) => set('range', v)} options={options.ranges} />
      <Select label="Species" value={get('species')} onChange={(v) => set('species', v)} options={options.species} />
      <Select label="Category" value={get('category')} onChange={(v) => set('category', v)} options={CATEGORIES} />
      <Select label="Production stage" value={get('stage')} onChange={(v) => set('stage', v)} options={STAGES} />
      <Select label="Market" value={get('market')} onChange={(v) => set('market', v)} options={MARKETS.map((m) => [m.id, m.market])} />
      <Select label="Language" value={get('language')} onChange={(v) => set('language', v)} options={LANGUAGES} />
      <Select
        label={local ? `Status (${marketLabel(context, true)})` : 'Content status'} value={get('status')} onChange={(v) => set('status', v)}
        options={local ? [['approved', 'Approved'], ['in_review', 'In review'], ['draft', 'Draft'], ['outdated', 'Outdated'], ['missing', 'Missing']] : [['approved', 'Approved'], ['in_review', 'In review'], ['draft', 'Draft']]}
      />
      <Select label="Completeness" value={get('complete') || get('issue')} onChange={(v) => {
        const next = new URLSearchParams(params)
        next.delete('complete'); next.delete('issue')
        if (v === 'yes' || v === 'no') next.set('complete', v); else if (v) next.set('issue', v)
        setParams(next, { replace: true })
      }} options={[['yes', 'Complete'], ['no', 'Incomplete'], ...Object.entries(ISSUES).map(([k, l]) => [k, `Missing ${l.toLowerCase()}`] as [string, string])]} />
    </>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Product library</h1>
          <p className="muted">{rows.length} of {products.length} products{local && !showAll ? ` sold in ${marketLabel(context, true)}` : ''}</p>
        </div>
      </div>

      {local && (
        <div className="context-note">
          You are working in <strong>{marketLabel(context)}</strong>. Status shows the local version for this market.
          <button className="link-btn" onClick={() => set('all', showAll ? '' : '1')}>{showAll ? `Only products sold in ${marketLabel(context, true)}` : 'Show all products'}</button>
        </div>
      )}

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden />
          <input type="search" placeholder="Search name, species, range, code…" value={get('q')} onChange={(e) => set('q', e.target.value)} aria-label="Search products" />
        </label>
        <button className={`btn btn-secondary filters-toggle${active.length ? ' has' : ''}`} onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={16} /> Filters{active.length ? ` (${active.length})` : ''}
        </button>
        <select className="sort" value={get('sort') || 'name'} onChange={(e) => set('sort', e.target.value === 'name' ? '' : e.target.value)} aria-label="Sort">
          <option value="name">Sort: Name</option>
          <option value="updated">Sort: Recently updated</option>
          <option value="completeness">Sort: Least complete</option>
        </select>
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'table' ? 'on' : ''} onClick={() => changeView('table')} aria-label="Table view"><List size={18} /></button>
          <button className={view === 'grid' ? 'on' : ''} onClick={() => changeView('grid')} aria-label="Grid view"><LayoutGrid size={18} /></button>
        </div>
      </div>
      <div className={`filters${showFilters ? ' open' : ''}`}>{selects}</div>

      {active.length > 0 && (
        <div className="chips">
          {active.map((k) => (
            <button key={k} className="chip" onClick={() => set(k, '')}>{chipLabel(k, get(k))}<X size={14} /></button>
          ))}
          <button className="link-btn" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Search size={32} />} title="No products match">
          <p className="muted">Try another search term or remove some filters.</p>
          <button className="btn btn-secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Reset search and filters</button>
        </EmptyState>
      ) : view === 'table' ? (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="hide-md">Range</th>
                <th className="hide-lg">Stage</th>
                <th>{local ? marketLabel(context, true) : 'Status'}</th>
                <th>Completeness</th>
                <th className="hide-md">Markets</th>
                <th className="hide-lg">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, c }) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/products/${p.id}`} className="prod-cell">
                      <Thumb url={productThumb(p, blobUrls)} size={40} />
                      <span>
                        <strong>{p.name}</strong>
                        <span className="muted small block">{p.species} · {p.code}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hide-md"><span className="small">{p.range}</span><span className="muted small block">{p.category}</span></td>
                  <td className="hide-lg small">{p.stages.join(', ')}</td>
                  <td>{local ? <StatusBadge status={variantState(p, context)} small /> : <StatusBadge status={overallStatus(p)} small />}</td>
                  <td style={{ minWidth: 130 }}><CompletenessBar score={c.score} /></td>
                  <td className="hide-md"><MarketChips p={p} /></td>
                  <td className="hide-lg small muted nowrap">{timeAgo(lastUpdated(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid">
          {rows.map(({ p, c }) => (
            <Link key={p.id} to={`/products/${p.id}`} className="pcard">
              <div className="pcard-img"><img src={productThumb(p, blobUrls, 'wide')} alt="" />{!hasHero(p) && <span className="pcard-flag">No hero image</span>}</div>
              <div className="pcard-body">
                <div className="pcard-top">
                  <span className="muted small">{p.range}</span>
                  {local ? <StatusBadge status={variantState(p, context)} small /> : <StatusBadge status={overallStatus(p)} small />}
                </div>
                <strong>{p.name}</strong>
                <span className="muted small">{p.species} · {p.stages.join(', ')}</span>
                <CompletenessBar score={c.score} />
                <MarketChips p={p} max={5} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[] }) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o]
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </label>
  )
}

export function MarketChips({ p, max = 7 }: { p: Product; max?: number }) {
  if (!p.markets.length) return <span className="muted small">No markets</span>
  return (
    <span className="mchips">
      {p.markets.slice(0, max).map((m) => {
        const st = variantState(p, m)
        return (
          <span key={m} className={`mchip seg-${st}`} title={`${marketLabel(m)}: ${VARIANT_STATE_LABEL[st]}`}>
            {m.split('-')[1] ?? m.toUpperCase()}
          </span>
        )
      })}
      {p.markets.length > max && <span className="muted small">+{p.markets.length - max}</span>}
    </span>
  )
}
