// Small building blocks shared by the product page tabs.
import type { ReactNode } from 'react'
import type { User } from '../../types'
import type { FieldDef } from '../../lib/fields'
import { displayValue, isEmptyValue } from '../../lib/fields'
import { listAsText } from '../../lib/files'
import { Empty } from '../../components/ui'

export const asText = (v: string | string[]) => (Array.isArray(v) ? listAsText(v) : v)

/** Marketing text: paragraphs, or a bullet list */
export function CopyValue({ value, empty }: { value: string | string[]; empty?: ReactNode }) {
  if (Array.isArray(value)) {
    const items = value.filter(Boolean)
    return items.length ? <ul className="bullets">{items.map((b, i) => <li key={i}>{b}</li>)}</ul> : <>{empty ?? <Empty />}</>
  }
  return value.trim() ? <div className="prose">{value.split(/\n\n+/).map((t, i) => <p key={i}>{t}</p>)}</div> : <>{empty ?? <Empty />}</>
}

/** Any field value, shown the way its kind suggests */
export function AttrValue({ f, value, users }: { f: FieldDef; value: string | string[]; users: User[] }) {
  if (isEmptyValue(value)) return <Empty />
  if (f.kind === 'list' && f.group === 'copy') return <CopyValue value={value} />
  if (f.kind === 'list' || f.kind === 'multi') return <span className="tags">{(value as string[]).map((x) => <span className="tag" key={x}>{x}</span>)}</span>
  if (f.kind === 'longtext') return <CopyValue value={value} />
  if (f.key === 'tagline') return <span className="tagline-value">{value as string}</span>
  return <span>{displayValue(f, value, users)}</span>
}

/** Trim text and drop empty list items before saving */
export function cleanPatch<T extends object>(d: T): T {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : typeof v === 'string' ? v.trim() : v])) as T
}
