import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, MessageSquareWarning, Send, X } from 'lucide-react'
import type { Meta, Product, Section, User } from '../../types'
import { can, type Check as CheckT } from '../../data/rules'
import { saveVariant, sectionLabel, setContext, transition } from '../../data/store'
import { marketLabel } from '../../data/reference'
import { Card, Modal, StatusBadge, UpdatedBy } from '../../components/ui'

export function SidePanel({ p, user, context, checks }: { p: Product; user: User; context: string; checks: CheckT[] }) {
  const blocks: { section: Section; meta: Meta }[] =
    context === 'global'
      ? [{ section: 'info', meta: p.info }, { section: 'marketing', meta: p.marketing.meta }]
      : p.variants[context] ? [{ section: context, meta: p.variants[context].meta }] : []
  const variant = context !== 'global' ? p.variants[context] : undefined

  return (
    <aside className="product-side">
      <Card title="Workflow">
        <div className="wf">
          {blocks.length === 0 && <p className="muted small pad">No {marketLabel(context)} version yet.</p>}
          {blocks.map((b) => <WorkflowBlock key={b.section} p={p} user={user} section={b.section} meta={b.meta} />)}
          {variant && (
            <div className="wf-block">
              <div className="wf-row">
                <span className="wf-title">On the website</span>
                <label className="switch">
                  <input
                    type="checkbox" checked={variant.websiteStatus === 'live'} disabled={!can.editMarket(user, context)}
                    onChange={(e) => saveVariant(p.id, context, { websiteStatus: e.target.checked ? 'live' : 'not_live' }, true)}
                  />
                  <span>{variant.websiteStatus === 'live' ? 'Live' : 'Not live'}</span>
                </label>
              </div>
              <p className="muted small">Tracked here for reference only – the website manages its own publishing.</p>
            </div>
          )}
        </div>
      </Card>
      <Checklist p={p} checks={checks} />
    </aside>
  )
}

function WorkflowBlock({ p, user, section, meta }: { p: Product; user: User; section: Section; meta: Meta }) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const isLocal = section !== 'info' && section !== 'marketing'
  const canEdit = isLocal ? can.editMarket(user, section) : can.editGlobal(user)
  const canApprove = can.approve(user)
  return (
    <div className="wf-block">
      <div className="wf-row">
        <span className="wf-title">{isLocal ? 'Local version' : sectionLabel(section)}</span>
        <StatusBadge status={meta.status} small />
      </div>
      <div className="small muted">
        {section === 'marketing' && <>Version {p.marketing.version} · </>}Last updated by <UpdatedBy by={meta.updatedBy} at={meta.updatedAt} />
      </div>
      {meta.reviewNote && meta.status === 'draft' && (
        <div className="note note-warn"><MessageSquareWarning size={16} /><span><strong>Changes requested:</strong> {meta.reviewNote}</span></div>
      )}
      <div className="wf-actions">
        {meta.status === 'draft' && canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => transition(p.id, section, 'in_review')}><Send size={14} /> Submit for review</button>
        )}
        {meta.status === 'draft' && !canEdit && <span className="small muted">Waiting for the editor to submit.</span>}
        {meta.status === 'in_review' && canApprove && (
          <>
            <button className="btn btn-approve btn-sm" onClick={() => transition(p.id, section, 'approved')}><Check size={14} /> Approve</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAsking(true)}><X size={14} /> Request changes</button>
          </>
        )}
        {meta.status === 'in_review' && !canApprove && <span className="small muted">Waiting for an approver.</span>}
        {meta.status === 'approved' && <span className="small muted">Approved content. Editing creates a new draft.</span>}
      </div>
      {asking && (
        <Modal
          title="Request changes"
          onClose={() => setAsking(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setAsking(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!note.trim()} onClick={() => { transition(p.id, section, 'draft', note.trim()); setAsking(false); setNote('') }}>Send back to editor</button>
          </>}
        >
          <p className="muted">{sectionLabel(section)} for {p.name} – {p.species} goes back to draft with your note.</p>
          <label className="field"><span>What needs to change?</span><textarea rows={4} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please align the benefits with the latest datasheet." /></label>
        </Modal>
      )}
    </div>
  )
}

const GROUPS = [
  { id: 'info', label: 'Product information', tab: 'information' },
  { id: 'marketing', label: 'Marketing content', tab: 'marketing' },
  { id: 'assets', label: 'Required assets', tab: 'assets' },
  { id: 'markets', label: 'Local versions', tab: 'marketing' },
]

function Checklist({ p, checks }: { p: Product; checks: CheckT[] }) {
  const navigate = useNavigate()
  const goto = (tab: string, ctx = 'global') => { setContext(ctx); navigate(`/products/${p.id}/${tab}`, { replace: true }) }
  return (
    <section className="card" id="checklist">
      <header className="card-head"><h2>Completeness</h2></header>
      <div className="checklist">
        {GROUPS.map((g) => {
          const items = checks.filter((c) => c.group === g.id)
          if (!items.length) return g.id === 'markets' ? (
            <div key={g.id} className="cl-group"><div className="cl-head">{g.label}</div><p className="small muted">No target markets yet. <button className="link-btn" onClick={() => goto('markets')}>Add markets</button></p></div>
          ) : null
          const done = items.filter((i) => i.ok).length
          return (
            <div key={g.id} className="cl-group">
              <div className="cl-head">{g.label}<span className="muted small">{done}/{items.length}</span></div>
              <ul>
                {items.map((c) => (
                  <li key={c.id}>
                    <button className={`cl-item${c.ok ? ' ok' : ` bad-${c.problem}`}`} onClick={() => goto(g.tab, c.locale ?? 'global')}>
                      {c.ok ? <Check size={14} /> : c.problem === 'outdated' ? <AlertTriangle size={14} /> : <X size={14} />}
                      <span>{c.locale ? marketLabel(c.locale) : c.label}</span>
                      {!c.ok && <span className="cl-why">{c.problem === 'outdated' ? 'Outdated' : c.problem === 'incomplete' ? 'Incomplete' : 'Missing'}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
