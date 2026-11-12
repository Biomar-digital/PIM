import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ClipboardCheck, Undo2 } from 'lucide-react'
import { currentUser, transition, useStore, userName } from '../data/store'
import { allBlocks, blockHref, blockLabel, type Block } from '../data/insights'
import { can } from '../data/rules'
import { MARKETS, marketLabel } from '../data/reference'
import { productImage } from '../lib/files'
import { timeAgo } from '../lib/format'
import { EmptyState, SendBackModal, Thumb } from '../components/ui'

type TabId = 'waiting' | 'sent_back'

export default function Approvals() {
  const products = useStore((s) => s.db.products)
  const user = useStore(currentUser)
  const blobUrls = useStore((s) => s.blobUrls)
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('waiting')
  const [market, setMarket] = useState('')
  const [sendBack, setSendBack] = useState<Block | null>(null)

  const blocks = useMemo(() => allBlocks(products), [products])
  const byMarket = (b: Block) => !market || (market === 'global' ? b.section === 'global' : b.section === market)
  const lists: Record<TabId, Block[]> = {
    waiting: blocks.filter((b) => b.status === 'in_review').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
    sent_back: blocks.filter((b) => b.status === 'draft' && b.reviewNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  }
  const list = lists[tab].filter(byMarket)
  const approver = can.approve(user)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p className="muted">{approver ? 'Content sent for approval by the global and local teams. Oldest first.' : 'Content waiting for an approver. Only approvers can approve.'}</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="seg seg-text" role="tablist">
          <button role="tab" aria-selected={tab === 'waiting'} className={tab === 'waiting' ? 'on' : ''} onClick={() => setTab('waiting')}>Waiting ({lists.waiting.length})</button>
          <button role="tab" aria-selected={tab === 'sent_back'} className={tab === 'sent_back' ? 'on' : ''} onClick={() => setTab('sent_back')}>Sent back ({lists.sent_back.length})</button>
        </div>
        <select id="approvals-market" value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Show content for">
          <option value="">Global and all markets</option>
          <option value="global">Global content only</option>
          {MARKETS.map((m) => <option key={m.id} value={m.id}>{marketLabel(m.id)}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={32} />} title={tab === 'waiting' ? 'Nothing is waiting for approval' : 'Nothing has been sent back'}><p className="muted">All caught up.</p></EmptyState>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>What</th><th className="hide-md">{tab === 'waiting' ? 'Sent by' : 'Sent back by'}</th><th /></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={`${b.product.id}-${b.section}`} className="row-click" onClick={() => navigate(blockHref(b.product.id, b.section))}>
                  <td>
                    <span className="prod-cell">
                      <Thumb url={productImage(b.product, blobUrls)} size={36} />
                      <span><strong>{b.product.name} – {b.product.species}</strong><span className="muted small block">{b.product.range}</span></span>
                    </span>
                  </td>
                  <td>{blockLabel(b.section)}{b.reviewNote && tab === 'sent_back' && <span className="small muted block clamp-1">“{b.reviewNote}”</span>}</td>
                  <td className="hide-md small">{userName(b.updatedBy)}<span className="muted block">{timeAgo(b.updatedAt)}</span></td>
                  <td className="nowrap right" onClick={(e) => e.stopPropagation()}>
                    {tab === 'waiting' && approver ? (
                      <div className="row-gap end">
                        <button className="btn btn-approve btn-sm" onClick={() => transition(b.product.id, b.section, 'approved')}><Check size={14} />Approve</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSendBack(b)}><Undo2 size={14} /><span className="hide-sm">Send back</span></button>
                      </div>
                    ) : (
                      <Link className="btn btn-secondary btn-sm" to={blockHref(b.product.id, b.section)}>Open</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sendBack && (
        <SendBackModal
          what={`${blockLabel(sendBack.section)} for ${sendBack.product.name} – ${sendBack.product.species}`}
          onClose={() => setSendBack(null)}
          onSend={(note) => { transition(sendBack.product.id, sendBack.section, 'draft', note); setSendBack(null) }}
        />
      )}
    </div>
  )
}
