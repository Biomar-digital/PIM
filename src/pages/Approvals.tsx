import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ClipboardCheck, X } from 'lucide-react'
import { currentUser, setContext, transition, useStore, userName } from '../data/store'
import { allBlocks, label, type ReviewItem } from '../data/insights'
import { can } from '../data/rules'
import { MARKETS } from '../data/reference'
import { timeAgo } from '../lib/format'
import { productThumb } from '../lib/artwork'
import { EmptyState, Modal, StatusBadge, Thumb } from '../components/ui'

type TabId = 'review' | 'changes' | 'approved'

export default function Approvals() {
  const products = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('review')
  const [market, setMarket] = useState('')
  const [asking, setAsking] = useState<ReviewItem | null>(null)
  const [note, setNote] = useState('')

  const blocks = useMemo(() => allBlocks(products), [products])
  const filterMarket = (b: ReviewItem) => !market || (market === 'global' ? b.section === 'info' || b.section === 'marketing' : b.section === market)
  const lists: Record<TabId, ReviewItem[]> = {
    review: blocks.filter((b) => b.status === 'in_review'),
    changes: blocks.filter((b) => b.status === 'draft' && b.reviewNote),
    approved: blocks.filter((b) => b.status === 'approved').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40),
  }
  const list = lists[tab].filter(filterMarket).sort((a, b) => (tab === 'approved' ? 0 : a.updatedAt.localeCompare(b.updatedAt)))
  const approver = can.approve(user)
  const open = (b: ReviewItem) => {
    const local = b.section !== 'info' && b.section !== 'marketing'
    setContext(local ? b.section : 'global')
    navigate(`/products/${b.product.id}/${b.section === 'info' ? 'information' : 'marketing'}`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p className="muted">{approver ? 'Review content submitted by global and local editors.' : 'Content waiting for approval. Only approvers can approve or send back.'}</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="seg seg-text" role="tablist">
          <button className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>Waiting for review ({lists.review.length})</button>
          <button className={tab === 'changes' ? 'on' : ''} onClick={() => setTab('changes')}>Changes requested ({lists.changes.length})</button>
          <button className={tab === 'approved' ? 'on' : ''} onClick={() => setTab('approved')}>Recently approved</button>
        </div>
        <select value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Filter by market">
          <option value="">All content</option>
          <option value="global">Global content only</option>
          {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.market} – {m.language}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={32} />} title={tab === 'review' ? 'Nothing waiting for review' : 'Nothing here'}><p className="muted">All caught up.</p></EmptyState>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Content</th><th className="hide-md">{tab === 'review' ? 'Submitted' : 'Updated'}</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={`${b.product.id}-${b.section}`} className="row-click" onClick={() => open(b)}>
                  <td>
                    <span className="prod-cell">
                      <Thumb url={productThumb(b.product, blobUrls)} size={36} />
                      <span><strong>{b.product.name}</strong><span className="muted small block">{b.product.species}</span></span>
                    </span>
                  </td>
                  <td>{label(b.section)}{b.reviewNote && tab === 'changes' && <span className="small muted block clamp-1">“{b.reviewNote}”</span>}</td>
                  <td className="hide-md small">{userName(b.updatedBy)}<span className="muted block">{timeAgo(b.updatedAt)}</span></td>
                  <td><StatusBadge status={b.status} small /></td>
                  <td className="nowrap" onClick={(e) => e.stopPropagation()}>
                    {tab === 'review' && approver ? (
                      <div className="row-gap">
                        <button className="btn btn-approve btn-sm" onClick={() => transition(b.product.id, b.section, 'approved')}><Check size={14} /> Approve</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setAsking(b)}><X size={14} /> <span className="hide-sm">Request changes</span></button>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => open(b)}>Open</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {asking && (
        <Modal title="Request changes" onClose={() => setAsking(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setAsking(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={!note.trim()} onClick={() => { transition(asking.product.id, asking.section, 'draft', note.trim()); setAsking(null); setNote('') }}>Send back to editor</button>
        </>}>
          <p className="muted">{label(asking.section)} for {asking.product.name} – {asking.product.species} goes back to draft with your note.</p>
          <label className="field"><span>What needs to change?</span><textarea rows={4} autoFocus value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </Modal>
      )}
    </div>
  )
}
