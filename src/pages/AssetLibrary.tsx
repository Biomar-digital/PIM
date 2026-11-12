import { useMemo, useState } from 'react'
import { FolderOpen, Search } from 'lucide-react'
import type { Asset, Product } from '../types'
import { useStore } from '../data/store'
import { ASSET_TYPES, MARKETS } from '../data/reference'
import { AssetCard, PreviewModal } from '../components/assets'
import { EmptyState } from '../components/ui'

export default function AssetLibrary() {
  const products = useStore((s) => s.db.products)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [range, setRange] = useState('')
  const [scope, setScope] = useState('')
  const [preview, setPreview] = useState<{ p: Product; a: Asset } | null>(null)
  const ranges = useMemo(() => [...new Set(products.map((p) => p.range))].sort(), [products])

  const items = useMemo(() => {
    const t = q.toLowerCase()
    return products
      .flatMap((p) => p.assets.map((a) => ({ p, a })))
      .filter(({ p, a }) =>
        (!t || `${a.fileName} ${p.name} ${p.species} ${p.range}`.toLowerCase().includes(t)) &&
        (!type || a.type === type) && (!range || p.range === range) && (!scope || a.scope === scope))
      .sort((x, y) => y.a.uploadedAt.localeCompare(x.a.uploadedAt))
  }, [products, q, type, range, scope])

  const shown = items.slice(0, 120)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Asset library</h1>
          <p className="muted">{items.length} files across all products. Upload new files from a product's Assets tab.</p>
        </div>
      </div>
      <div className="toolbar">
        <label className="search"><Search size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file or product name…" aria-label="Search assets" /></label>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Asset type"><option value="">All types</option>{ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range"><option value="">All ranges</option>{ranges.map((r) => <option key={r}>{r}</option>)}</select>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Market"><option value="">Global & local</option><option value="global">Global only</option>{MARKETS.map((m) => <option key={m.id} value={m.id}>{m.market} – {m.language}</option>)}</select>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<FolderOpen size={32} />} title="No assets found"><p className="muted">Try another search or filter.</p></EmptyState>
      ) : (
        <div className="asset-grid asset-grid-lg">
          {shown.map(({ p, a }) => <AssetCard key={a.id} p={p} a={a} showProduct onPreview={() => setPreview({ p, a })} />)}
        </div>
      )}
      {items.length > shown.length && <p className="muted small center mt">Showing the {shown.length} most recent. Narrow the search to see more.</p>}
      {preview && (
        <PreviewModal p={preview.p} a={preview.a} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
