import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Search } from 'lucide-react'
import type { Asset } from '../types'
import { useStore } from '../data/store'
import { ASSET_TYPES, MARKETS, marketLabel } from '../data/reference'
import { FileCard, PreviewModal } from '../components/files'
import { EmptyState } from '../components/ui'

export default function Files() {
  const products = useStore((s) => s.db.products)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [range, setRange] = useState('')
  const [scope, setScope] = useState('')
  const [preview, setPreview] = useState<Asset | null>(null)
  const ranges = useMemo(() => [...new Set(products.map((p) => p.range))].sort(), [products])

  const items = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return products
      .flatMap((p) => p.assets.map((a) => ({ p, a })))
      .filter(({ p, a }) =>
        terms.every((t) => `${a.fileName} ${p.name} ${p.species} ${p.range}`.toLowerCase().includes(t)) &&
        (!type || a.type === type) && (!range || p.range === range) && (!scope || a.scope === scope))
      .sort((x, y) => x.p.name.localeCompare(y.p.name) || x.a.type.localeCompare(y.a.type))
  }, [products, q, type, range, scope])

  const shown = items.slice(0, 120)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Files</h1>
          <p className="muted">{items.length} files: logos, packshots, datasheets and more. To add files, open a product and go to Files.</p>
        </div>
      </div>
      <div className="toolbar">
        <label className="search"><Search size={18} /><input id="file-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file or product name" aria-label="Search files" /></label>
      </div>
      <div className="filters">
        <label className={`filter${type ? ' set' : ''}`}><span>Type</span><select id="file-type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All</option>{ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className={`filter${range ? ' set' : ''}`}><span>Range</span><select id="file-range" value={range} onChange={(e) => setRange(e.target.value)}><option value="">All</option>{ranges.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className={`filter${scope ? ' set' : ''}`}><span>For</span><select id="file-scope" value={scope} onChange={(e) => setScope(e.target.value)}><option value="">All markets and local</option><option value="global">All markets only</option>{MARKETS.map((m) => <option key={m.id} value={m.id}>{marketLabel(m.id)}</option>)}</select></label>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<FolderOpen size={32} />} title="No files found"><p className="muted">Try another search or filter.</p></EmptyState>
      ) : (
        <div className="file-grid file-grid-lg">
          {shown.map(({ p, a }) => <FileCard key={a.id} p={p} a={a} showProduct onPreview={() => setPreview(a)} />)}
        </div>
      )}
      {items.length > shown.length && <p className="muted small center mt">Showing the first {shown.length}. Search or filter to find the rest. <Link to="/products">Or open a product.</Link></p>}
      {preview && <PreviewModal a={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
