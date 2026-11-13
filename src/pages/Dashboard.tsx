import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { currentUser, requestsFor, setLocale, useStore, userName } from '../data/store'
import { TaggedForYou } from '../components/tagging'
import { DIVISIONS, GLOBAL, GROUP_BY_ID, MARKET_BY_ID, isGroup, localeLanguage, scopeLocales } from '../data/reference'
import { photo } from '../lib/brand'
import { can, isGlobalUser, type LocaleState } from '../data/rules'
import { attentionCounts, localeOverview, productsIn, recentChanges, workItems, type Attention, type WorkItem } from '../data/insights'
import { productImage } from '../lib/files'
import { timeAgo } from '../lib/format'
import { Card, Thumb } from '../components/ui'
import { LocaleCode, localeName } from '../components/Layout'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const copyWord = (loc: string) => (loc === GLOBAL || isGroup(loc) || localeLanguage(loc) === 'English' ? 'local' : localeLanguage(loc))

/** Photo for the dashboard header, chosen by division */
function heroPhoto(loc: string): string {
  const div = GROUP_BY_ID[loc]?.division ?? (GROUP_BY_ID[loc]?.kind === 'division' ? loc : MARKET_BY_ID[loc]?.division ?? '')
  const d = GROUP_BY_ID[loc]?.kind === 'division' ? loc : div
  if (d === 'd:salmon') return photo('salmon-farm')
  if (d === 'd:latam' || d === 'd:asia') return photo('pellets-in-hands')
  if (loc === GLOBAL) return photo('salmon-underwater')
  return photo('salmon-feeding-underwater')
}

export default function Dashboard() {
  const all = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const loc = useStore((s) => s.locale)
  const products = useMemo(() => productsIn(all, loc), [all, loc])
  const counts = useMemo(() => attentionCounts(all, loc), [all, loc])
  const work = useMemo(() => workItems(all, user, loc), [all, user, loc])
  const recent = useMemo(() => recentChanges(all, loc, 6), [all, loc])
  const tagged = useMemo(() => requestsFor(all, user.id), [all, user.id])
  const global = loc === GLOBAL
  const group = isGroup(loc)
  const name = localeName(loc)

  const stats: { show?: Attention; n: number; label: string; tone: string }[] = global ? [
    { n: products.length, label: 'Products', tone: 'neutral' },
    { show: 'in_review', n: counts.in_review, label: 'Awaiting approval', tone: 'review' },
    { show: 'needs_review', n: counts.needs_review, label: 'Local copy to review', tone: 'update' },
    { show: 'missing_copy', n: counts.missing_copy, label: 'Missing copy', tone: 'missing' },
    { show: 'missing_info', n: counts.missing_info, label: 'Missing information or assets', tone: 'missing' },
  ] : [
    { n: products.length, label: `Available in ${name}`, tone: 'neutral' },
    { show: 'missing_copy', n: counts.missing_copy, label: `Missing ${copyWord(loc)} copy`, tone: 'missing' },
    { show: 'needs_review', n: counts.needs_review, label: 'Global content changed', tone: 'update' },
    { show: 'in_review', n: counts.in_review, label: 'Awaiting approval', tone: 'review' },
    { show: 'missing_info', n: counts.missing_info, label: 'Missing information or assets', tone: 'missing' },
  ]

  return (
    <div className="page dash">
      <section className="dash-hero" style={{ backgroundImage: `url(${heroPhoto(loc)})` }}>
        <div className="dash-hero-text">
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p className="lead">
            {tagged.length > 0 && <>You have been tagged in <strong>{tagged.length} {tagged.length === 1 ? 'request' : 'requests'}</strong>. </>}
            {work.length ? <>There {work.length === 1 ? 'is' : 'are'} <strong>{work.length} {work.length === 1 ? 'task' : 'tasks'}</strong> waiting for you in {global ? 'the global record' : name}.</> : <>Everything in {global ? 'the global record' : name} is up to date.</>}
          </p>
          <div className="hero-scope">
            <LocaleCode id={loc} />
            <span><strong>{global ? 'Global' : name}</strong> · {global ? `${products.length} products, ${localeOverview(all).length} markets` : group ? `${products.length} products in ${scopeLocales(loc).length} markets` : `${localeLanguage(loc)}, ${products.length} products`}</span>
          </div>
        </div>
      </section>

      <nav className="stats" aria-label="Key numbers">
        {stats.map((t) => (
          <Link key={t.label} to={t.show ? `/products?show=${t.show}` : '/products'} className={`stat stat-${t.n === 0 && t.show ? 'ok' : t.tone}`}>
            <span className="stat-n">{t.n}</span>
            <span className="stat-label">{t.label}</span>
          </Link>
        ))}
      </nav>

      <div className="dash-main">
        <div className="dash-col">
        <TaggedForYou items={tagged} />
        <section className="attention" aria-labelledby="attention-title">
          <header className="section-head">
            <h2 id="attention-title">Needs your attention</h2>
            {work.length > 0 && <span className="muted small">{work.length} {work.length === 1 ? 'task' : 'tasks'}{global ? '' : ` in ${name}`}</span>}
          </header>
          {work.length === 0
            ? <div className="all-clear"><CheckCircle2 size={22} className="ok-ic" /><div><strong>Nothing waiting for you</strong><p className="muted small">{can.editLocale(user, loc) || can.approve(user, loc) ? 'Everything you work on here is up to date.' : 'You can find, copy and download approved content in Products.'}</p></div></div>
            : <WorkList items={work} />}
        </section>
        </div>

        <aside className="dash-side">
          {!global && !group && <StatusSummary loc={loc} />}
          {group && <RegionMarkets loc={loc} />}
          <section>
            <header className="section-head"><h2>Latest changes</h2></header>
            <ul className="activity">
              {recent.map((r, i) => (
                <li key={i}>
                  <Link to={`/products/${r.product.id}`} className="activity-row">
                    <Thumb url={productImage(r.product)} size={36} />
                    <span className="grow min0">
                      <strong className="clamp-1">{r.product.name} – {r.product.species}</strong>
                      <span className="block small">{r.summary}{r.section !== GLOBAL && r.section !== 'assets' && !scopeLocales(loc).includes(r.section) ? '' : r.section !== GLOBAL && r.section !== 'assets' ? ` · ${localeName(r.section)}` : ''}</span>
                      <span className="muted small">{userName(r.by)} · {timeAgo(r.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      {global && isGlobalUser(user) && <LocalesCard title="Markets by division" />}
    </div>
  )
}

/** The markets of a region, compactly: flag, progress and what needs review */
function RegionMarkets({ loc }: { loc: string }) {
  const all = useStore((s) => s.db.products)
  const rows = useMemo(() => localeOverview(all, scopeLocales(loc)), [all, loc])
  return (
    <section>
      <header className="section-head"><h2>Markets in {localeName(loc)}</h2></header>
      <ul className="market-list">
        {rows.map((r) => (
          <li key={r.id}>
            <button className="market-row" onClick={() => setLocale(r.id)} title={`Open ${r.market}`}>
              <LocaleCode id={r.id} />
              <span className="grow min0">
                <span className="market-row-top"><strong>{r.market}</strong><span className="muted small">{r.counts.approved} of {r.total} approved</span></span>
                <span className="stack-bar sm" aria-hidden>{STATE_ORDER.map((s) => r.counts[s] > 0 && <span key={s} className={`seg-${s}`} style={{ flex: r.counts[s] }} />)}</span>
                {(r.counts.needs_review > 0 || r.counts.in_review > 0) && (
                  <span className="small market-row-flags">
                    {r.counts.needs_review > 0 && <span className="warn-text">{r.counts.needs_review} to review</span>}
                    {r.counts.in_review > 0 && <span className="muted">{r.counts.in_review} in approval</span>}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Same-titled tasks fold into one group, so long lists stay readable. */
function WorkList({ items }: { items: WorkItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, WorkItem[]>()
    for (const w of items) map.set(`${w.tone}|${w.title}`, [...(map.get(`${w.tone}|${w.title}`) ?? []), w])
    return [...map.values()]
  }, [items])
  return <div className="work">{groups.map((g) => <WorkGroup key={g[0].tone + g[0].title} items={g} />)}</div>
}

function WorkGroup({ items }: { items: WorkItem[] }) {
  const [all, setAll] = useState(false)
  const first = items[0]
  const shown = all ? items.slice(0, 40) : items.slice(0, 3)
  return (
    <div className={`work-group tone-${first.tone}`}>
      <div className="work-group-head">
        <span className={`dot dot-${first.tone}`} aria-hidden />
        <strong>{first.title}</strong>
        <span className="count-pill">{items.length}</span>
        {items.length > 3 && (
          <button className="link-btn small" onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? <>Show fewer<ChevronDown size={14} /></> : <>Show all {items.length}<ChevronRight size={14} /></>}
          </button>
        )}
      </div>
      <ul className="work-list">
        {shown.map((w) => (
          <li key={w.key}>
            <Link to={`/products/${w.product.id}${w.locale !== GLOBAL ? `?locale=${w.locale}` : ''}`} className="work-row">
              <Thumb url={productImage(w.product)} size={40} />
              <span className="grow min0">
                <strong className="clamp-1">{w.product.name} – {w.product.species}</strong>
                <span className="muted small clamp-1">{w.detail}</span>
              </span>
              {w.locale !== GLOBAL && <LocaleCode id={w.locale} />}
              <ArrowRight size={16} className="work-arrow" aria-hidden />
            </Link>
          </li>
        ))}
        {all && items.length > 40 && <li className="muted small work-more">And {items.length - 40} more. Use the filters in Products to see them all.</li>}
      </ul>
    </div>
  )
}

const STATE_ORDER: LocaleState[] = ['approved', 'needs_review', 'in_review', 'draft', 'missing']
const STATE_SHOW: Partial<Record<LocaleState, Attention>> = { approved: 'approved', needs_review: 'needs_review', in_review: 'in_review', draft: 'draft', missing: 'missing_copy' }
const STATE_TEXT: Record<string, string> = { approved: 'Approved', needs_review: 'Needs review', in_review: 'In approval', draft: 'Draft', missing: 'Not started' }

/** Content status of every product in one locale, as a bar */
function StatusSummary({ loc }: { loc: string }) {
  const all = useStore((s) => s.db.products)
  const row = useMemo(() => localeOverview(all).find((r) => r.id === loc), [all, loc])
  if (!row) return null
  return (
    <section>
      <header className="section-head"><h2>{localeLanguage(loc)} content status</h2></header>
      <div>
        <div className="stack-bar" aria-hidden>
          {STATE_ORDER.map((s) => row.counts[s] > 0 && <span key={s} className={`seg-${s}`} style={{ flex: row.counts[s] }} />)}
        </div>
        <ul className="legend">
          {STATE_ORDER.map((s) => (
            <li key={s}>
              <Link to={`/products?show=${STATE_SHOW[s]}`} className="legend-row">
                <span className={`dot dot-${s}`} />{STATE_TEXT[s]}<span className="grow" /><strong>{row.counts[s]}</strong>
              </Link>
            </li>
          ))}
        </ul>
        <p className="muted small mt-sm">{row.live} of {row.total} marked as live on the website.</p>
      </div>
    </section>
  )
}

/** Markets at a glance: every market for global users (by division), or the markets of a region. */
function LocalesCard({ only, title = 'Markets' }: { only?: string[]; title?: string }) {
  const all = useStore((s) => s.db.products)
  const rows = useMemo(() => localeOverview(all, only), [all, only])
  const sections = only ? [{ id: '', name: '', rows }] : DIVISIONS.map((d) => ({ id: d.id, name: d.name, rows: rows.filter((r) => r.division === d.id) }))
  return (
    <Card title={title} className="mt-lg">
      <div className="table-wrap">
        <table className="table locales-table">
          <thead><tr><th>Market</th><th className="num">Products</th><th className="num">Approved</th><th className="num">Needs review</th><th className="num">In approval</th><th className="num">Draft</th><th className="num">Not started</th><th className="hide-md">Progress</th></tr></thead>
          <tbody>
            {sections.map((sec) => (
              <Fragment key={sec.id || 'all'}>
                {sec.name && <tr className="group-row click-row" onClick={() => setLocale(sec.id)}><td colSpan={8}>{sec.name}</td></tr>}
                {sec.rows.map((r) => (
                  <tr key={r.id} className="click-row" onClick={() => setLocale(r.id)} title={`Switch to ${r.market}`}>
                    <td><span className="row-gap"><LocaleCode id={r.id} /><span><strong>{r.market}</strong><span className="muted small block">{r.language}{!only && r.region && GROUP_BY_ID[r.region] ? ` · ${GROUP_BY_ID[r.region].name}` : ''}</span></span></span></td>
                    <td className="num">{r.total}</td>
                    <td className="num">{r.counts.approved || ''}</td>
                    <td className="num warn-text">{r.counts.needs_review || ''}</td>
                    <td className="num">{r.counts.in_review || ''}</td>
                    <td className="num">{r.counts.draft || ''}</td>
                    <td className="num">{r.counts.missing || ''}</td>
                    <td className="hide-md">
                      <div className="stack-bar sm" aria-label={`${r.counts.approved} of ${r.total} approved`}>
                        {STATE_ORDER.map((s) => r.counts[s] > 0 && <span key={s} className={`seg-${s}`} style={{ flex: r.counts[s] }} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
