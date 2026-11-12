import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import type { HistoryEntry, Product, User } from '../../types'
import { can } from '../../data/rules'
import { restoreVersion, sectionLabel, userName } from '../../data/store'
import { COPY_LABEL } from '../../data/reference'
import { formatDate, timeAgo } from '../../lib/format'
import { Avatar, Card, Modal } from '../../components/ui'

const FIELD_LABEL: Record<string, string> = {
  ...COPY_LABEL, name: 'Product name', species: 'Species', range: 'Range', categories: 'Category', stages: 'Production stage',
  code: 'Product code', feedType: 'Feed type', pelletSizes: 'Pellet sizes', packaging: 'Packaging', owner: 'Owner',
  lifecycle: 'Lifecycle', notes: 'Notes', localName: 'Local name', inheritsGlobal: 'Uses the English text',
}

export function HistoryTab({ p, user }: { p: Product; user: User }) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [restore, setRestore] = useState<HistoryEntry | null>(null)
  const sections = [...new Set(p.history.map((h) => h.section))]
  const list = p.history.filter((h) => !filter || h.section === filter)
  const canRestore = (h: HistoryEntry) => !!h.snapshot && h.section !== 'assets' && can.edit(user, h.section)

  return (
    <Card
      title="History"
      actions={
        <select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show changes for">
          <option value="">All changes</option>
          {sections.map((s) => <option key={s} value={s}>{sectionLabel(s)}</option>)}
        </select>
      }
    >
      <ol className="timeline">
        {list.map((h) => (
          <li key={h.id}>
            <Avatar name={userName(h.by)} size={30} />
            <div className="tl-body">
              <div><strong>{userName(h.by)}</strong> <span className="muted">· {sectionLabel(h.section)} · <span title={formatDate(h.at, true)}>{timeAgo(h.at)}</span></span></div>
              <div>{h.summary}</div>
              {h.snapshot && (
                <div className="tl-actions">
                  <button className="link-btn" onClick={() => setOpen(open === h.id ? null : h.id)}>
                    {open === h.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}See this version
                  </button>
                  {canRestore(h) && <button className="link-btn" onClick={() => setRestore(h)}><RotateCcw size={14} />Restore</button>}
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
          <button className="btn btn-primary" onClick={() => { restoreVersion(p.id, restore.id); setRestore(null) }}>Restore</button>
        </>}>
          <p>The {sectionLabel(restore.section).toLowerCase()} goes back to how it was on {formatDate(restore.at, true)}. It becomes a draft that needs approval. The current version stays in the history.</p>
        </Modal>
      )}
    </Card>
  )
}

function Snapshot({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="snapshot">
      {Object.entries(data).filter(([k]) => FIELD_LABEL[k]).map(([k, v]) => (
        <div key={k}>
          <dt>{FIELD_LABEL[k]}</dt>
          <dd>{Array.isArray(v) ? (v.length ? v.join(' · ') : 'Empty') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v || 'Empty')}</dd>
        </div>
      ))}
    </dl>
  )
}
