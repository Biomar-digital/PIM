import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, CircleOff, Clock, FileWarning, Package } from 'lucide-react'
import { currentUser, setLocale, useStore, userName } from '../data/store'
import { GLOBAL, localeLanguage } from '../data/reference'
import { can, isGlobalUser, type LocaleState } from '../data/rules'
import { attentionCounts, localeOverview, productsIn, recentChanges, workItems, type Attention, type WorkItem } from '../data/insights'
import { productImage } from '../lib/files'
import { timeAgo } from '../lib/format'
import { Card, EmptyState, Thumb } from '../components/ui'
import { LocaleCode, localeName } from '../components/Layout'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const copyWord = (loc: string) => (loc === GLOBAL || localeLanguage(loc) === 'English' ? 'local' : localeLanguage(loc))

export default function Dashboard() {
  const all = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const loc = useStore((s) => s.locale)
  const products = useMemo(() => productsIn(all, loc), [all, loc])
  const counts = useMemo(() => attentionCounts(all, loc), [all, loc])
  const work = useMemo(() => workItems(all, user, loc), [all, user, loc])
  const recent = useMemo(() => recentChanges(all, loc), [all, loc])
  const global = loc === GLOBAL
  const name = localeName(loc)

  const tiles: { show?: Attention; n: number; label: string; hint: string; icon: typeof Package; tone: string }[] = global ? [
    { n: products.length, label: 'Products', hint: 'Every product in the PIM', icon: Package, tone: 'neutral' },
    { show: 'in_review', n: counts.in_review, label: 'Awaiting approval', hint: 'Global records or local versions', icon: Clock, tone: 'review' },
    { show: 'needs_review', n: counts.needs_review, label: 'Local copy to review', hint: 'Global content changed since', icon: AlertTriangle, tone: 'update' },
    { show: 'missing_copy', n: counts.missing_copy, label: 'Missing copy', hint: 'English, or a locale where it is sold', icon: CircleOff, tone: 'missing' },
    { show: 'missing_info', n: counts.missing_info, label: 'Missing information or assets', hint: 'Core copy or bag design', icon: FileWarning, tone: 'missing' },
  ] : [
    { n: products.length, label: `Available in ${name}`, hint: 'Products sold in this locale', icon: Package, tone: 'neutral' },
    { show: 'missing_copy', n: counts.missing_copy, label: `Missing ${copyWord(loc)} copy`, hint: 'No description or benefits yet', icon: CircleOff, tone: 'missing' },
    { show: 'needs_review', n: counts.needs_review, label: 'Global content changed', hint: `${localeLanguage(loc)} copy needs review`, icon: AlertTriangle, tone: 'update' },
    { show: 'in_review', n: counts.in_review, label: 'Awaiting approval', hint: `${name} versions sent for approval`, icon: Clock, tone: 'review' },
    { show: 'missing_info', n: counts.missing_info, label: 'Missing information or assets', hint: 'Global copy or bag design', icon: FileWarning, tone: 'missing' },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="muted">{greeting()}, {user.name.split(' ')[0]}</p>
          <h1 className="row-gap"><LocaleCode id={loc} />{global ? 'Global overview' : name}</h1>
          <p className="muted">{global ? `All ${products.length} products and ${localeOverview(all).length} locales` : `${localeLanguage(loc)} · ${products.length} products available in ${name}`}</p>
        </div>
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <Link key={t.label} to={t.show ? `/products?show=${t.show}` : '/products'} className={`tile tile-${t.tone}${t.n === 0 && t.show ? ' tile-zero' : ''}`}>
            <span className="tile-top"><t.icon size={18} aria-hidden /><span className="tile-n">{t.n}</span></span>
            <strong>{t.label}</strong>
            <span className="muted small">{t.hint}</span>
          </Link>
        ))}
      </div>

      <div className="dash-grid mt">
        <Card title={`Your next steps${global ? '' : ` in ${name}`}`} className="span-2">
          {work.length === 0
            ? <EmptyState icon={<CheckCircle2 size={28} className="ok-ic" />} title="Nothing waiting for you">
                <p className="muted small">{can.editLocale(user, loc) ? 'Everything you work on here is up to date.' : 'You can find, copy and download approved content in Products.'}</p>
              </EmptyState>
            : <WorkList items={work} />}
        </Card>

        <div className="stack-gap">
        {!global && <StatusSummary loc={loc} />}
        <Card title="Latest changes">
          <ul className="activity">
            {recent.map((r, i) => (
              <li key={i}>
                <Link to={`/products/${r.product.id}`} className="activity-row">
                  <Thumb url={productImage(r.product)} size={34} />
                  <span className="grow">
                    <strong>{r.product.name} – {r.product.species}</strong>
                    <span className="block small">{r.summary}{r.section !== GLOBAL && r.section !== 'assets' && global ? ` · ${localeName(r.section)}` : ''}</span>
                    <span className="muted small">{userName(r.by)} · {timeAgo(r.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        </div>
        {global && isGlobalUser(user) && <LocalesCard />}
      </div>
    </div>
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
  const [open, setOpen] = useState(items.length <= 3)
  const first = items[0]
  return (
    <div className="work-group">
      <button className="work-group-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`dot dot-${first.tone}`} aria-hidden />
        <strong>{first.title}</strong>
        <span className="count-pill">{items.length}</span>
      </button>
      {open && (
        <ul className="work-list">
          {items.slice(0, 30).map((w) => (
            <li key={w.key}>
              <Link to={`/products/${w.product.id}${w.locale !== GLOBAL ? `?locale=${w.locale}` : ''}`} className="work-row">
                <Thumb url={productImage(w.product)} size={34} />
                <span className="grow">
                  <strong>{w.product.name} – {w.product.species}</strong>
                  <span className="muted small block">{w.detail}</span>
                </span>
                <ArrowRight size={16} className="muted" />
              </Link>
            </li>
          ))}
          {items.length > 30 && <li className="muted small pad-x">And {items.length - 30} more. Use the filters in Products to see them all.</li>}
        </ul>
      )}
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
    <Card title={`${localeLanguage(loc)} content status`}>
      <div className="pad">
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
        <p className="muted small mt">{row.live} of {row.total} marked as live on the website.</p>
      </div>
    </Card>
  )
}

/** Every locale at a glance, for global users */
function LocalesCard() {
  const all = useStore((s) => s.db.products)
  const rows = useMemo(() => localeOverview(all), [all])
  return (
    <Card title="Locales" className="span-3">
      <div className="table-wrap">
        <table className="table locales-table">
          <thead><tr><th>Locale</th><th className="num">Products</th><th className="num">Approved</th><th className="num">Needs review</th><th className="num">In approval</th><th className="num">Draft</th><th className="num">Not started</th><th className="hide-md">Progress</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="click-row" onClick={() => setLocale(r.id)} title={`Switch to ${r.market}`}>
                <td><span className="row-gap"><LocaleCode id={r.id} /><span><strong>{r.market}</strong><span className="muted small block">{r.language}</span></span></span></td>
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
          </tbody>
        </table>
      </div>
    </Card>
  )
}
