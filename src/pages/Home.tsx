import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ClipboardCheck, FileText, Languages, Package, Undo2 } from 'lucide-react'
import { currentUser, useStore, userName } from '../data/store'
import { homeNumbers, workItems, type WorkItem } from '../data/insights'
import { ROLE_LABEL } from '../data/reference'
import { productImage } from '../lib/files'
import { productTitle, timeAgo } from '../lib/format'
import { Card, Thumb } from '../components/ui'

const TONE_ICON: Record<WorkItem['tone'], typeof Package> = {
  approve: ClipboardCheck, sent_back: Undo2, update: AlertTriangle, missing: FileText, draft: FileText,
}

export default function Home() {
  const products = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const n = useMemo(() => homeNumbers(products), [products])
  const work = useMemo(() => workItems(products, user), [products, user])
  const recent = useMemo(
    () => products.flatMap((p) => p.history.slice(0, 4).map((h) => ({ p, h }))).sort((a, b) => b.h.at.localeCompare(a.h.at)).slice(0, 7),
    [products],
  )
  const first = user.name.split(' ')[0]

  return (
    <div className="page">
      <header className="home-head">
        <h1 className="hello">Hello {first}</h1>
        <p className="lead">
          {ROLE_LABEL[user.role]}{user.markets.length > 0 && <> for {user.markets.length === 1 ? 'one market' : `${user.markets.length} markets`}</>}.{' '}
          {work.length ? <>You have <strong>{work.length}</strong> {work.length === 1 ? 'thing' : 'things'} to look at.</> : 'Nothing needs your attention right now.'}
        </p>
      </header>

      <div className="kpis">
        <Kpi icon={<Package />} value={n.products} label="Products" to="/products" />
        <Kpi icon={<ClipboardCheck />} value={n.waiting} label="Waiting for approval" to="/approvals" tone="review" />
        <Kpi icon={<Languages />} value={n.needsUpdate} label="Translations to update" to="/products?market_state=needs_update" tone="update" />
        <Kpi icon={<FileText />} value={n.copyIncomplete} label="Marketing copy incomplete" to="/products?todo=copy" tone="missing" />
      </div>

      <div className="home-grid">
        <Card title="Your to-do list" className="home-work">
          {work.length === 0 ? (
            <p className="muted pad">All done. Nice work.</p>
          ) : (
            <ul className="work-list">
              {work.slice(0, 9).map((w) => {
                const Icon = TONE_ICON[w.tone]
                return (
                  <li key={w.key}>
                    <Link className="work-item" to={w.href}>
                      <Thumb url={productImage(w.product, blobUrls)} size={44} />
                      <span className="work-text">
                        <span className={`work-title tone-${w.tone}`}><Icon size={14} />{w.title}</span>
                        <strong>{productTitle(w.product)}</strong>
                        <span className="muted small clamp-1">{w.detail}</span>
                      </span>
                      <ArrowRight size={16} className="muted" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {work.length > 9 && <p className="pad small muted">And {work.length - 9} more.</p>}
        </Card>

        <Card title="Latest changes" className="home-recent">
          <ul className="activity">
            {recent.map(({ p, h }) => (
              <li key={h.id}>
                <Thumb url={productImage(p, blobUrls)} size={32} />
                <div className="activity-text">
                  <Link to={`/products/${p.id}`} className="strong">{productTitle(p)}</Link>
                  <span className="small muted clamp-1">{h.summary}</span>
                  <span className="small muted">{userName(h.by)}, {timeAgo(h.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ icon, value, label, to, tone }: { icon: ReactNode; value: number; label: string; to: string; tone?: string }) {
  return (
    <Link to={to} className={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <span className="kpi-icon">{icon}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </Link>
  )
}
