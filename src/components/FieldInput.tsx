import type { User } from '../types'
import type { FieldDef } from '../lib/fields'
import { ListEditor } from './ui'

/** Input for one product field, chosen by the field's kind. */
export function FieldInput({ f, value, onChange, users, compact, autoFocus }: {
  f: FieldDef
  value: string | string[]
  onChange: (v: string | string[]) => void
  users: User[]
  /** Spreadsheet cell editor: lists are edited as lines in one text box */
  compact?: boolean
  autoFocus?: boolean
}) {
  const id = `field-${f.key}${compact ? '-cell' : ''}`
  if (f.kind === 'select') {
    return (
      <select id={id} autoFocus={autoFocus} value={value as string} onChange={(e) => onChange(e.target.value)}>
        {f.key === 'feedType' && <option value="">Not set</option>}
        {f.options!(users).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  if (f.kind === 'multi') {
    const list = value as string[]
    const all = f.options!(users)
    return (
      <div className="checks">
        {all.map((o) => (
          <label key={o.value} className="check">
            <input type="checkbox" checked={list.includes(o.value)} onChange={(e) => onChange(e.target.checked ? all.map((x) => x.value).filter((x) => x === o.value || list.includes(x)) : list.filter((x) => x !== o.value))} />
            {o.label}
          </label>
        ))}
      </div>
    )
  }
  if (f.kind === 'list') {
    if (compact) {
      return <textarea id={id} autoFocus={autoFocus} rows={5} value={(value as string[]).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} placeholder="One per line" />
    }
    return <ListEditor id={id} value={value as string[]} onChange={onChange} multiline={f.group === 'copy'} placeholder={f.group === 'copy' ? 'Add a point and press Enter' : 'Add and press Enter'} />
  }
  const max = f.key === 'tagline' ? 70 : f.key === 'shortDescription' ? 200 : 0
  const s = value as string
  return (
    <>
      {f.kind === 'longtext'
        ? <textarea id={id} autoFocus={autoFocus} rows={f.key === 'description' ? (compact ? 8 : 7) : 3} value={s} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} autoFocus={autoFocus} value={s} onChange={(e) => onChange(e.target.value)} />}
      {max > 0 && !compact && <span className={`counter${s.length > max ? ' over' : ''}`}>{s.length} of {max} characters</span>}
    </>
  )
}
