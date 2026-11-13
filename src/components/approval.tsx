import { useState } from 'react'
import { AtSign, Check, Copy, MessageSquareWarning, Send, Undo2 } from 'lucide-react'
import type { Meta, Product, Section, User } from '../types'
import { GLOBAL } from '../data/reference'
import { can, essentialTodos } from '../data/rules'
import { openTag, sectionLabel, transition, userName, type TagDraft } from '../data/store'
import { Modal, SendBackModal } from './ui'

/** The buttons that move content through Draft, In approval and Approved. */
export function ApprovalActions({ p, section, meta, user }: { p: Product; section: Section; meta: Meta; user: User }) {
  const [sendBack, setSendBack] = useState(false)
  const [confirmSend, setConfirmSend] = useState<string[] | null>(null)
  const editable = can.editLocale(user, section)
  const send = () => {
    const missing = section === GLOBAL ? essentialTodos(p).map((t) => t.label) : []
    if (missing.length) setConfirmSend(missing)
    else transition(p.id, section, 'in_review')
  }
  return (
    <>
      {meta.status === 'draft' && editable && (
        <button className="btn btn-primary" onClick={send}><Send size={16} />Send for approval</button>
      )}
      {confirmSend && (
        <Modal title="Some essentials are still missing" onClose={() => setConfirmSend(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setConfirmSend(null)}>Go back and add them</button>
          <button className="btn btn-primary" onClick={() => { transition(p.id, section, 'in_review'); setConfirmSend(null) }}>Send anyway</button>
        </>}>
          <p>{p.name} – {p.species} can be approved, but it will not be <strong>ready to use</strong> until these are added:</p>
          <ul className="bullets">{confirmSend.map((m) => <li key={m}>{m}</li>)}</ul>
        </Modal>
      )}
      {meta.status === 'in_review' && can.approve(user, section) && (
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

export type SaveMode = 'draft' | 'submit' | 'minor'

/**
 * Buttons under an edit form. Approved content offers two ways to save:
 * a small update (typo or wording fix: stays approved, nobody has to review it), or a change that needs approval.
 */
export interface AlsoApply {
  /** The same product for other species */
  options: Product[]
  selected: string[]
  onChange: (ids: string[]) => void
}

/** "Also apply to the same product for other species" */
function AlsoApplyPicker({ also }: { also: AlsoApply }) {
  const [open, setOpen] = useState(also.selected.length > 0)
  const { options, selected, onChange } = also
  const all = selected.length === options.length
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="also">
      <label className="check also-main">
        <input type="checkbox" checked={open} onChange={(e) => { setOpen(e.target.checked); onChange(e.target.checked ? options.map((o) => o.id) : []) }} />
        <Copy size={14} aria-hidden />
        <span>Also apply these changes to {options[0].name} for other species <span className="muted">({options.length})</span></span>
      </label>
      {open && (
        <div className="also-body">
          <div className="also-list">
            {options.map((o) => (
              <label key={o.id} className={`also-chip${selected.includes(o.id) ? ' on' : ''}`}>
                <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />{o.species}
              </label>
            ))}
            <button type="button" className="link-btn small" onClick={() => onChange(all ? [] : options.map((o) => o.id))}>{all ? 'Clear all' : 'Select all'}</button>
          </div>
          <p className="muted small">Only the fields you changed are copied; everything else stays as it is for each species. Each one keeps its own approval. Check that the text does not mention a species by name.</p>
        </div>
      )}
    </div>
  )
}

export function EditActions({ meta, onCancel, onSave, disabled, tag, also }: { meta: Meta; onCancel: () => void; onSave: (mode: SaveMode) => void; disabled?: boolean; tag?: TagDraft; also?: AlsoApply }) {
  const approved = meta.status === 'approved'
  return (
    <div className="edit-actions">
      {also && also.options.length > 0 && <AlsoApplyPicker also={also} />}
      {approved && <p className="muted small grow">A <strong>small update</strong> (typo, wording) stays approved and does not ask other locales to review. Anything bigger goes through approval.</p>}
      <div className="row-gap wrap end">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        {tag && <button className="btn btn-secondary" disabled={disabled} onClick={() => { onSave('draft'); openTag(tag) }} title="Save as a draft and tag someone to review or translate it"><AtSign size={16} />Save and tag someone</button>}
        {approved && <button className="btn btn-secondary" disabled={disabled} onClick={() => onSave('minor')}>Save as small update</button>}
        {meta.status === 'in_review'
          ? <button className="btn btn-primary" disabled={disabled} onClick={() => onSave('draft')}>Save</button>
          : <>
            <button className="btn btn-secondary" disabled={disabled} onClick={() => onSave('draft')}>Save as draft</button>
            <button className="btn btn-primary" disabled={disabled} onClick={() => onSave('submit')}><Send size={16} />Save and send for approval</button>
          </>}
      </div>
    </div>
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
