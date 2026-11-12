import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, CircleDashed, Clock, Copy, X } from 'lucide-react'
import { MARKET_STATE_LABEL, type MarketState } from '../data/rules'
import { initials } from '../lib/format'
import { copyText } from '../lib/files'
import { toast, useStore, userName } from '../data/store'

/* ---------- Status ---------- */

const STATUS_ICON: Record<MarketState, typeof Clock> = {
  approved: CheckCircle2,
  in_review: Clock,
  draft: CircleDashed,
  needs_update: AlertTriangle,
  not_started: CircleDashed,
}

export function StatusBadge({ status, small }: { status: MarketState; small?: boolean }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={`badge badge-${status}${small ? ' badge-sm' : ''}`}>
      <Icon size={small ? 12 : 14} aria-hidden />
      {MARKET_STATE_LABEL[status]}
    </span>
  )
}

/* ---------- Empty values ---------- */

export function Empty({ text = 'Not added yet' }: { text?: string }) {
  return <span className="empty-value">{text}</span>
}

/* ---------- People ---------- */

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 45% 38%)` }} aria-hidden>
      {initials(name)}
    </span>
  )
}

export function When({ at }: { at: string }) {
  return <time dateTime={at} title={new Date(at).toLocaleString('en-GB')}>{new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
}

export function UpdatedBy({ by, at }: { by: string; at: string }) {
  useStore((s) => s.db.users) // re-render when people change
  return <span>{userName(by)}, <When at={at} /></span>
}

/* ---------- Copy ---------- */

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  if (!text.trim()) return null
  return (
    <button
      type="button"
      className={`copy-btn${done ? ' done' : ''}`}
      onClick={async () => {
        const ok = await copyText(text)
        if (ok) { setDone(true); setTimeout(() => setDone(false), 1500) } else toast('Copy is blocked here. Select the text instead.', 'info')
      }}
      title={label}
      aria-label={label}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      <span>{done ? 'Copied' : label}</span>
    </button>
  )
}

/* ---------- Modal ---------- */

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

/** Small confirm/note dialog for "Send back". */
export function SendBackModal({ what, onClose, onSend }: { what: string; onClose: () => void; onSend: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <Modal title="Send back to the editor" onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!note.trim()} onClick={() => onSend(note.trim())}>Send back</button>
    </>}>
      <p className="muted">{what} goes back to draft. Tell the editor what to change.</p>
      <label className="field"><span>What needs to change?</span>
        <textarea id="send-back-note" rows={4} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: please align the benefits with the latest datasheet." />
      </label>
    </Modal>
  )
}

/* ---------- Dropdown menu ---------- */

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOutside() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onOutside])
  return ref
}

export function Menu({ label, icon, items }: { label: string; icon?: ReactNode; items: { label: string; icon?: ReactNode; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside<HTMLDivElement>(close)
  return (
    <div className="menu" ref={ref}>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        {icon}{label}<ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {items.map((i) => (
            <button key={i.label} role="menuitem" className="menu-item" onClick={() => { setOpen(false); i.onClick() }}>{i.icon}{i.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- List editor (benefits, pellet sizes...) ---------- */

export function ListEditor({ id, value, onChange, placeholder, multiline }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; multiline?: boolean }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    onChange([...value, draft.trim()])
    setDraft('')
  }
  return (
    <div className="list-editor">
      {value.map((item, i) => (
        <div className="list-editor-row" key={i}>
          {multiline ? (
            <textarea id={`${id}-${i}`} rows={2} value={item} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          ) : (
            <input id={`${id}-${i}`} value={item} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          )}
          <button type="button" className="icon-btn" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}><X size={16} /></button>
        </div>
      ))}
      <div className="list-editor-row">
        <input
          id={`${id}-new`} value={draft} placeholder={placeholder ?? 'Add and press Enter'} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>Add</button>
      </div>
    </div>
  )
}

/* ---------- Misc ---------- */

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}><CheckCircle2 size={16} />{t.text}</div>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  )
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Thumb({ url, size = 44 }: { url: string; size?: number }) {
  return <img src={url} alt="" className="thumb" style={{ width: size, height: size }} />
}
