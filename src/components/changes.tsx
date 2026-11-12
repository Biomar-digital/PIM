import type { Copy, Product, Variant, VersionText } from '../types'
import { COPY_FIELDS, DETAIL_FIELDS } from '../types'
import { COPY_LABEL } from '../data/reference'
import { changedFields, diffList, diffText, type Part } from '../lib/diff'
import { Empty } from './ui'

const DETAIL_LABEL: Record<string, string> = {
  name: 'Product name', species: 'Species', range: 'Range', categories: 'Category', stages: 'Production stage',
  code: 'Product code', feedType: 'Feed type', pelletSizes: 'Pellet sizes', packaging: 'Packaging', owner: 'Owner',
  lifecycle: 'Lifecycle', notes: 'Internal notes',
}
export const FIELD_LABEL: Record<string, string> = { ...COPY_LABEL, ...DETAIL_LABEL }

const ALL_FIELDS = [...COPY_FIELDS, ...DETAIL_FIELDS] as const
type Field = (typeof ALL_FIELDS)[number]
type Values = Partial<Record<Field, unknown>>

export interface ChangeSet {
  before?: Values
  after: Values
  fields: Field[]
}

const current = (p: Product): Values => ({ ...p, ...p.content }) as unknown as Values
const latestApproved = (p: Product): VersionText | undefined => p.versions?.[p.content.version]

/** Proposed global changes compared with the last approved version. */
export function globalChanges(p: Product): ChangeSet {
  const before = latestApproved(p) as Values | undefined
  const after = current(p)
  return { before, after, fields: changedFields(before, after, ALL_FIELDS) }
}

/** Proposed translation changes compared with the last approved translation. */
export function variantChanges(v: Variant): ChangeSet {
  const before = v.approved as Values | undefined
  const after = v as unknown as Values
  return { before, after, fields: changedFields(before, after, COPY_FIELDS) }
}

/** What changed in English since the version a translation was based on. */
export function englishChangesSince(p: Product, v: Variant): ChangeSet {
  const before = p.versions?.[v.sourceVersion] as Values | undefined
  const after = (latestApproved(p) ?? (p.content as Copy)) as Values
  return { before, after, fields: changedFields(before, after, COPY_FIELDS) }
}

function Parts({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((x, i) => {
        const lead = x.text.startsWith(' ') ? ' ' : ''
        const t = x.text.trimStart()
        return x.kind === 'added' ? <span key={i}>{lead}<ins className="d-add">{t}</ins></span>
          : x.kind === 'removed' ? <span key={i}>{lead}<del className="d-del">{t}</del></span>
          : <span key={i}>{x.text}</span>
      })}
    </>
  )
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])
const asText = (v: unknown): string => (v == null ? '' : String(v))

/** One field, old and new merged: added text green, removed text struck through. */
export function DiffValue({ before, after }: { before: unknown; after: unknown }) {
  if (Array.isArray(before) || Array.isArray(after)) {
    const items = diffList(asList(before), asList(after))
    if (!items.length) return <Empty text="Empty" />
    return (
      <ul className="bullets diff">
        {items.map((it, i) => (
          <li key={i} className={`d-item d-item-${it.kind}`}>
            {it.kind === 'added' ? <ins className="d-add">{it.text}</ins> : it.kind === 'removed' ? <del className="d-del">{it.text}</del> : it.kind === 'changed' ? <Parts parts={it.parts!} /> : it.text}
          </li>
        ))}
      </ul>
    )
  }
  const a = asText(before)
  const b = asText(after)
  if (!a && !b) return <Empty text="Empty" />
  return (
    <div className="prose diff"><p><Parts parts={diffText(a, b)} /></p></div>
  )
}

/** A list of the changed fields, each with its highlighted difference. */
export function ChangeList({ changes, emptyText = 'No text changes.' }: { changes: ChangeSet; emptyText?: string }) {
  // First version: nothing approved before, so show all text as new
  const first = !changes.before
  const fields = first
    ? COPY_FIELDS.filter((f) => { const v = changes.after[f]; return Array.isArray(v) ? v.length > 0 : !!v })
    : changes.fields
  if (!fields.length) return <p className="muted small">{emptyText}</p>
  return (
    <div className="changes">
      {first && <p className="muted small">This is the first version, so all text is new.</p>}
      {fields.map((f) => (
        <div key={f} className="change">
          <h3>{FIELD_LABEL[f] ?? f}</h3>
          <DiffValue before={first ? (Array.isArray(changes.after[f]) ? [] : '') : changes.before?.[f]} after={changes.after[f]} />
        </div>
      ))}
    </div>
  )
}

export function DiffLegend() {
  return (
    <span className="diff-legend small muted">
      <ins className="d-add">Added</ins> <del className="d-del">Removed</del>
    </span>
  )
}
