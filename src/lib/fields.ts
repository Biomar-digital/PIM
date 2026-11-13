// One definition of every editable product field, shared by the product page, the spreadsheet
// view and Excel import/export, so they always agree on labels, types and allowed values.
import type { Copy, DetailField, Product, User } from '../types'
import { CATEGORIES, FEED_TYPES, LIFECYCLE_LABEL, RANGES, SPECIES, STAGES } from '../data/reference'

export type FieldKey = DetailField | keyof Copy
export type FieldKind = 'text' | 'longtext' | 'list' | 'select' | 'multi'
export type FieldGroup = 'identity' | 'technical' | 'copy' | 'management'

export interface FieldDef {
  key: FieldKey
  label: string
  group: FieldGroup
  kind: FieldKind
  hint?: string
  /** Allowed values for select / multi fields */
  options?: (users: User[]) => { value: string; label: string }[]
  /** Width in the spreadsheet, px */
  width: number
}

const opts = (list: string[]) => () => list.map((v) => ({ value: v, label: v }))

export const GROUP_LABEL: Record<FieldGroup, string> = {
  identity: 'Product identity',
  technical: 'Technical information',
  copy: 'Marketing copy',
  management: 'Ownership',
}
/** Groups managed only by the global team, the same in every locale */
export const GLOBAL_GROUPS: FieldGroup[] = ['identity', 'technical', 'management']

export const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Product name', group: 'identity', kind: 'text', width: 180 },
  { key: 'range', label: 'Range', group: 'identity', kind: 'select', options: opts(RANGES), width: 140 },
  { key: 'categories', label: 'Category', group: 'identity', kind: 'multi', options: opts(CATEGORIES), width: 190 },
  { key: 'species', label: 'Species', group: 'identity', kind: 'select', options: opts(SPECIES), width: 160 },
  { key: 'stages', label: 'Production stage', group: 'identity', kind: 'multi', options: opts(STAGES), width: 160 },
  { key: 'tagline', label: 'Tagline', group: 'identity', kind: 'text', hint: 'One short line with the product promise. The same in every locale, never translated.', width: 260 },
  { key: 'code', label: 'Product code', group: 'technical', kind: 'text', width: 140 },
  { key: 'feedType', label: 'Feed type', group: 'technical', kind: 'select', options: opts(FEED_TYPES), width: 150 },
  { key: 'pelletSizes', label: 'Pellet sizes', group: 'technical', kind: 'list', hint: 'One size per line, for example 4.5 mm', width: 190 },
  { key: 'packaging', label: 'Packaging', group: 'technical', kind: 'list', hint: 'One pack per line, for example 25 kg bag', width: 190 },
  { key: 'shortDescription', label: 'Short description', group: 'copy', kind: 'longtext', hint: 'One or two sentences for product cards', width: 320 },
  { key: 'description', label: 'Description', group: 'copy', kind: 'longtext', hint: 'Full text for websites and sales material', width: 360 },
  { key: 'keyBenefits', label: 'Key benefits', group: 'copy', kind: 'list', hint: 'What the customer gains, one per line', width: 320 },
  { key: 'sellingPoints', label: 'Selling points', group: 'copy', kind: 'list', hint: 'Arguments for sales teams, one per line', width: 300 },
  { key: 'owner', label: 'Owner', group: 'management', kind: 'select', options: (users) => users.map((u) => ({ value: u.id, label: u.name })), width: 160 },
  { key: 'lifecycle', label: 'Lifecycle', group: 'management', kind: 'select', options: () => Object.entries(LIFECYCLE_LABEL).map(([value, label]) => ({ value, label })), width: 130 },
  { key: 'notes', label: 'Internal notes', group: 'management', kind: 'longtext', hint: 'Anything colleagues should know', width: 240 },
]

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, FieldDef>
export const fieldsIn = (g: FieldGroup) => FIELDS.filter((f) => f.group === g)

/** Current value of a field on a product */
export function getValue(p: Product, key: FieldKey): string | string[] {
  if (key in p.content) return (p.content as unknown as Record<string, string | string[]>)[key]
  return (p as unknown as Record<string, string | string[]>)[key]
}

export const isEmptyValue = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).length === 0 : !String(v ?? '').trim())

/** Value shown to people (select values turned into their labels) */
export function displayValue(f: FieldDef, v: string | string[], users: User[]): string {
  if (f.kind === 'select' && f.options) return f.options(users).find((o) => o.value === v)?.label ?? String(v ?? '')
  return Array.isArray(v) ? v.join(', ') : String(v ?? '')
}

/* ---------- Spreadsheet cells (Excel and the in-app grid) ---------- */

/** Lists are written one item per line inside the cell */
export function toCell(f: FieldDef, v: string | string[], users: User[]): string {
  if (f.kind === 'list' || f.kind === 'multi') return (v as string[]).filter(Boolean).join('\n')
  return displayValue(f, v, users)
}

/** Parse a cell back into a value. Returns an error message for values that are not allowed. */
export function fromCell(f: FieldDef, raw: unknown, users: User[]): { value?: string | string[]; error?: string } {
  const text = raw == null ? '' : String(raw).trim()
  if (f.kind === 'list') return { value: text.split(/\r?\n|;\s*/).map((s) => s.trim()).filter(Boolean) }
  if (f.kind === 'multi') {
    const items = text.split(/\r?\n|[;,]\s*/).map((s) => s.trim()).filter(Boolean)
    const allowed = f.options!(users)
    const out: string[] = []
    for (const it of items) {
      const match = allowed.find((o) => o.label.toLowerCase() === it.toLowerCase() || o.value.toLowerCase() === it.toLowerCase())
      if (!match) return { error: `“${it}” is not a known ${f.label.toLowerCase()}` }
      out.push(match.value)
    }
    return { value: out }
  }
  if (f.kind === 'select') {
    if (!text) return f.key === 'feedType' ? { value: '' } : { error: `${f.label} cannot be empty` }
    const match = f.options!(users).find((o) => o.label.toLowerCase() === text.toLowerCase() || o.value.toLowerCase() === text.toLowerCase())
    return match ? { value: match.value } : { error: `“${text}” is not a known ${f.label.toLowerCase()}` }
  }
  if (f.key === 'name' && !text) return { error: 'Product name cannot be empty' }
  return { value: text }
}

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '')
