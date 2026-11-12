import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, ClipboardCopy, Download, FileDown } from 'lucide-react'
import { currentUser, toast, useStore, userName } from '../data/store'
import { isReady, todos } from '../data/rules'
import { LIFECYCLE_LABEL } from '../data/reference'
import { copyText, downloadProductSheet, productAsText, productImage } from '../lib/files'
import { EmptyState, Menu, ReadyBadge, StatusBadge, When } from '../components/ui'
import { ApprovalActions, SentBackNote, StatusHint } from '../components/approval'
import { Overview } from './product/Overview'
import { TranslationsTab } from './product/TranslationsTab'
import { FilesTab } from './product/FilesTab'
import { HistoryTab } from './product/HistoryTab'

export default function ProductPage() {
  const { id, tab = 'overview' } = useParams()
  const product = useStore((s) => s.db.products.find((p) => p.id === id))
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const navigate = useNavigate()
  const t = useMemo(() => (product ? todos(product) : []), [product])

  if (!product) {
    return <div className="page"><EmptyState title="Product not found"><Link to="/products" className="btn btn-secondary">Back to products</Link></EmptyState></div>
  }
  const p = product
  const translationIssues = t.filter((x) => x.area === 'markets').length
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'translations', label: `Translations (${p.markets.length})`, alert: translationIssues },
    { id: 'files', label: `Files (${p.assets.length})`, alert: t.filter((x) => x.area === 'files').length },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="page product-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/products">Products</Link><ChevronRight size={14} /><span>{p.name} – {p.species}</span>
      </nav>

      <header className="phead card">
        <img src={productImage(p, blobUrls)} alt="" className="phead-logo" />
        <div className="phead-main">
          <h1>{p.name} <span className="phead-species">– {p.species}</span></h1>
          <p className="phead-sub">{[p.range, ...p.categories, ...p.stages].filter(Boolean).join(' · ')}{p.lifecycle !== 'active' && ` · ${LIFECYCLE_LABEL[p.lifecycle]}`}</p>
          <div className="phead-status">
            <StatusBadge status={p.status.status} />
            {isReady(p) && <ReadyBadge />}
            <StatusHint meta={p.status} user={user} section="global" />
          </div>
          <p className="muted small">Owner {userName(p.owner)} · Last change by {userName(p.status.updatedBy)}, <When at={p.status.updatedAt} /></p>
        </div>
        <div className="phead-actions">
          <ApprovalActions p={p} section="global" meta={p.status} user={user} />
          <Menu
            label="Export"
            icon={<Download size={16} />}
            items={[
              { label: 'Copy all text', icon: <ClipboardCopy size={16} />, onClick: async () => toast((await copyText(productAsText(p))) ? 'Product text copied' : 'Copy is blocked here', 'info') },
              { label: 'Download product sheet (PDF)', icon: <FileDown size={16} />, onClick: () => downloadProductSheet(p) },
            ]}
          />
        </div>
      </header>
      <SentBackNote meta={p.status} />

      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={`tab${tab === x.id ? ' on' : ''}`}
            onClick={() => navigate(x.id === 'overview' ? `/products/${p.id}` : `/products/${p.id}/${x.id}`, { replace: true })}>
            {x.label}
            {!!x.alert && <span className="tab-dot" title={`${x.alert} to do`} />}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview p={p} user={user} todos={t} />}
      {tab === 'translations' && <TranslationsTab p={p} user={user} />}
      {tab === 'files' && <FilesTab p={p} user={user} />}
      {tab === 'history' && <HistoryTab p={p} user={user} />}
    </div>
  )
}
