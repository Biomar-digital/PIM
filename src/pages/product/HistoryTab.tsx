import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import type { HistoryEntry, Product, User } from '../../types'
import { can } from '../../data/rules'
import { restoreVersion, sectionLabel, userName } from '../../data/store'
import { formatDate, timeAgo } from '../../lib/format'
import { Avatar, Card, Modal } from '../../components/ui'

const ACTION_LABEL: Record<string, string> = {
  created: 'Created', edited: 'Edited', submitted: 'Submitted', approved: 'Approved', changes_requested: 'Changes requested',
  restored: 'Restored', asset_added: 'Asset added', asset_removed: 'Asset removed', market_added: 'Market added',
  market_removed: 'Market removed', variant_created: 'Local version created',
}

const FIELD_LABEL: Record<string, string> = {
  shortDescription: 'Short description', keyBenefits: 'Key benefits', sellingPoints: 'Selling points', localName: 'Local name',
  pelletSizes: 'Pellet sizes', feedType: 'Feed type', regulatoryNotes: 'Notes', inheritsGlobal: 'Uses global copy',
}

export function HistoryTab({ p, user }: { p: Product; user: User }) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [restore, setRestore] = useState<HistoryEntry | null>(null)
  const sections = [...new Set(p.history.map((h) => h.section))]
  const list = p.history.filter((h) => !filter || h.section === filter)
  const canRestore = (h: HistoryEntry) =>
    !!h.snapshot && (h.section === 'info' || h.section === 'marketing' ? can.editGlobal(user) : can.editMarket(user, h.section))

  return (
    <Card
      title={<>Version history <span className="muted small">· {p.history.length} changes</span></>}
      actions={
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter history">
          <option value="">All sections</option>
          {sections.map((s) => <option key={s} value={s}>{sectionLabel(s)}</option>)}
        </select>
      }
    >
      <ol className="timeline">
        {list.map((h) => (
          <li key={h.id}>
            <Avatar name={userName(h.by)} size={30} />
            <div className="tl-body">
              <div className="tl-head">
                <span className={`tl-action act-${h.action}`}>{ACTION_LABEL[h.action] ?? h.action}</span>
                <span className="tag tag-muted">{sectionLabel(h.section)}</span>
                <span className="muted small" title={formatDate(h.at, true)}>{timeAgo(h.at)}</span>
              </div>
              <div>{h.summary}</div>
              <div className="muted small">{userName(h.by)} · {formatDate(h.at, true)}</div>
              {h.snapshot && (
                <div className="tl-actions">
                  <button className="link-btn" onClick={() => setOpen(open === h.id ? null : h.id)}>
                    {open === h.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />} View this version
                  </button>
                  {canRestore(h) && <button className="link-btn" onClick={() => setRestore(h)}><RotateCcw size={14} /> Restore</button>}
                </div>
              )}
              {open === h.id && h.snapshot && <Snapshot data={h.snapshot} />}
            </div>
          </li>
        ))}
      </ol>
      {restore && (
        <Modal title="Restore this version?" onClose={() => setRestore(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setRestore(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { restoreVersion(p.id, restore.id); setRestore(null) }}>Restore as draft</button>
        </>}>
          <p>The {sectionLabel(restore.section).toLowerCase()} will be set back to how it was on {formatDate(restore.at, true)}. It becomes a draft that needs approval again. The current version stays in the history.</p>
        </Modal>
      )}
    </Card>
  )
}

function Snapshot({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="snapshot">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt>{FIELD_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1)}</dt>
          <dd>{Array.isArray(v) ? (v.length ? v.join(' · ') : '—') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v || '—')}</dd>
        </div>
      ))}
    </dl>
  )
}
