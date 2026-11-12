import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Image as ImageIcon, X, XCircle } from 'lucide-react'
import type { Status } from '../types'
import { STATUS_LABEL } from '../data/reference'
import { VARIANT_STATE_LABEL, type VariantState } from '../data/rules'
import { initials } from '../lib/format'
import { useStore, userName } from '../data/store'

/* ---------- Status ---------- */

const STATUS_ICON = {
  approved: CheckCircle2,
  in_review: Clock,
  draft: CircleDashed,
  outdated: AlertTriangle,
  missing: XCircle,
}

export function StatusBadge({ status, small }: { status: Status | VariantState; small?: boolean }) {
  const Icon = STATUS_ICON[status]
  const label = (STATUS_LABEL as Record<string, string>)[status] ?? VARIANT_STATE_LABEL[status as VariantState]
  return (
    <span className={`badge badge-${status}${small ? ' badge-sm' : ''}`}>
      <Icon size={small ? 12 : 14} aria-hidden />
      {label}
    </span>
  )
}

/* ---------- Completeness ---------- */

export function scoreTone(score: number) {
  return score === 100 ? 'good' : score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'bad'
}

export function CompletenessBar({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  return (
    <div className="cbar" title={`${score}% complete`}>
      <div className="cbar-track">
        <div className={`cbar-fill tone-${scoreTone(score)}`} style={{ width: `${score}%` }} />
      </div>
      {showLabel && <span className="cbar-label">{score}%</span>}
    </div>
  )
}

export function CompletenessRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className={`ring tone-${scoreTone(score)}`} role="img" aria-label={`${score}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2} cy={size / 2} r={r} className="ring-fill"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{score}%</text>
    </svg>
  )
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

export function UpdatedBy({ by, at }: { by: string; at: string }) {
  useStore((s) => s.db.users) // re-render on user rename
  return (
    <span className="muted small">
      {userName(by)} · <time dateTime={at} title={new Date(at).toLocaleString('en-GB')}>{new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
    </span>
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

/* ---------- Dropdown ---------- */

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOutside() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onOutside])
  return ref
}

/* ---------- List editor (benefits, pellet sizes...) ---------- */

export function ListEditor({ value, onChange, placeholder, multiline }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; multiline?: boolean }) {
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
            <textarea rows={2} value={item} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          ) : (
            <input value={item} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          )}
          <button type="button" className="icon-btn" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}><X size={16} /></button>
        </div>
      ))}
      <div className="list-editor-row">
        <input
          value={draft} placeholder={placeholder ?? 'Add item'} onChange={(e) => setDraft(e.target.value)}
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
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.tone === 'warn' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {t.text}
        </div>
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

export function Thumb({ url, size = 44 }: { url: string | null; size?: number }) {
  return url ? (
    <img src={url} alt="" className="thumb" style={{ width: size, height: size }} />
  ) : (
    <span className="thumb thumb-empty" style={{ width: size, height: size }} title="No hero image"><ImageIcon size={size * 0.4} /></span>
  )
}

