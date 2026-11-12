import { useState } from 'react'
import { Check, MessageSquareWarning, Send, Undo2 } from 'lucide-react'
import type { Meta, Product, Section, User } from '../types'
import { can } from '../data/rules'
import { sectionLabel, transition, userName } from '../data/store'
import { SendBackModal } from './ui'

/** The one or two buttons that move content through Draft, Waiting for approval and Approved. */
export function ApprovalActions({ p, section, meta, user }: { p: Product; section: Section; meta: Meta; user: User }) {
  const [sendBack, setSendBack] = useState(false)
  const editable = can.edit(user, section)
  return (
    <>
      {meta.status === 'draft' && editable && (
        <button className="btn btn-primary" onClick={() => transition(p.id, section, 'in_review')}><Send size={16} />Send for approval</button>
      )}
      {meta.status === 'in_review' && can.approve(user) && (
        <>
          <button className="btn btn-approve" onClick={() => transition(p.id, section, 'approved')}><Check size={16} />Approve</button>
          <button className="btn btn-secondary" onClick={() => setSendBack(true)}><Undo2 size={16} />Send back</button>
        </>
      )}
      {sendBack && (
        <SendBackModal
          what={`${sectionLabel(section)} for ${p.name} – ${p.species}`}
          onClose={() => setSendBack(false)}
          onSend={(note) => { transition(p.id, section, 'draft', note); setSendBack(false) }}
        />
      )}
    </>
  )
}

/** Banner shown when an approver sent the content back. */
export function SentBackNote({ meta }: { meta: Meta }) {
  if (meta.status !== 'draft' || !meta.reviewNote) return null
  return (
    <div className="note note-warn">
      <MessageSquareWarning size={18} />
      <div><strong>Sent back by {userName(meta.updatedBy)}:</strong> {meta.reviewNote}</div>
    </div>
  )
}

/** One line explaining what happens next, shown beside the status. */
export function StatusHint({ meta, user, section }: { meta: Meta; user: User; section: Section }) {
  const editable = can.edit(user, section)
  if (meta.status === 'approved') return <span className="muted small">{editable ? 'Approved. Any change creates a new draft.' : 'Approved and ready to use.'}</span>
  if (meta.status === 'in_review') return <span className="muted small">{can.approve(user) ? 'Check the content, then approve or send it back.' : 'Waiting for an approver.'}</span>
  return <span className="muted small">{editable ? 'Draft. Send it for approval when it is ready.' : 'Draft. The editor has not sent it for approval yet.'}</span>
}
