import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Circle, Lock, Pencil } from 'lucide-react'
import type { CopyField, Product, User } from '../../types'
import { TODO_AREA_LABEL, can, marketState, type Todo } from '../../data/rules'
import { ChangeList, DiffLegend, globalChanges } from '../../components/changes'
import { saveGlobal, useStore, type GlobalPatch } from '../../data/store'
import { marketLabel } from '../../data/reference'
import { GROUP_LABEL, displayValue, fieldsIn, getValue, isEmptyValue, type FieldDef, type FieldGroup } from '../../lib/fields'
import { FieldInput } from '../../components/FieldInput'
import { productPackshot } from '../../lib/files'
import { Card, CopyButton, Empty, ListEditor, StatusBadge } from '../../components/ui'

export const COPY_HINT: Record<CopyField, string> = {
  tagline: 'One short line with the product promise',
  shortDescription: 'One or two sentences for product cards and listings',
  description: 'The full product text for websites and sales material',
  keyBenefits: 'What the customer gains, one point per line',
  sellingPoints: 'Arguments for sales teams, one point per line',
}

const asText = (v: string | string[]) => (Array.isArray(v) ? v.filter(Boolean).map((x) => `• ${x}`).join('\n') : v)

export function CopyValue({ value, empty }: { value: string | string[]; empty?: ReactNode }) {
  if (Array.isArray(value)) {
    const items = value.filter(Boolean)
    return items.length ? <ul className="bullets">{items.map((b, i) => <li key={i}>{b}</li>)}</ul> : <>{empty ?? <Empty />}</>
  }
  return value.trim() ? <div className="prose">{value.split(/\n\n+/).map((t, i) => <p key={i}>{t}</p>)}</div> : <>{empty ?? <Empty />}</>
}

export function CopyInput({ field, value, onChange, placeholder }: { field: CopyField; value: string | string[]; onChange: (v: string | string[]) => void; placeholder?: string }) {
  if (Array.isArray(value)) return <ListEditor id={`edit-${field}`} value={value} onChange={onChange} multiline placeholder={placeholder ?? 'Add a point and press Enter'} />
  const max = field === 'tagline' ? 70 : field === 'shortDescription' ? 200 : 0
  return (
    <>
      {field === 'tagline'
        ? <input id={`edit-${field}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <textarea id={`edit-${field}`} rows={field === 'description' ? 8 : 3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
      {max > 0 && <span className={`counter${value.length > max ? ' over' : ''}`}>{value.length} of {max} characters</span>}
    </>
  )
}

type Editing = null | FieldGroup

/** Order of the attribute groups on the product page */
const PAGE_GROUPS: FieldGroup[] = ['copy', 'classification', 'specification', 'management']

export function Overview({ p, user, todos }: { p: Product; user: User; todos: Todo[] }) {
  const [editing, setEditing] = useState<Editing>(null)
  const refs = useRef<Partial<Record<FieldGroup, HTMLDivElement | null>>>({})
  const canEdit = can.editGlobal(user)
  const startEdit = (what: 'copy' | 'details') => {
    if (!canEdit) return
    const g: FieldGroup = what === 'copy' ? 'copy' : 'specification'
    setEditing(g)
    refs.current[g]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="overview">
      <div className="overview-main">
        <ChangesCard p={p} />
        {PAGE_GROUPS.map((g) => (
          <div key={g} ref={(el) => { refs.current[g] = el }}>
            <AttributeGroup p={p} group={g} editing={editing === g} canEdit={canEdit} onEdit={() => setEditing(g)} onDone={() => setEditing(null)} />
          </div>
        ))}
      </div>
      <aside className="overview-side">
        <TodoCard p={p} todos={todos} canEdit={canEdit} onEdit={startEdit} />
        <PackshotCard p={p} />
        <MarketsCard p={p} />
      </aside>
    </div>
  )
}

/* ---------------- Attribute groups ---------------- */

/** One group of fields in a label | value layout, edited as a whole. */
function AttributeGroup({ p, group, editing, canEdit, onEdit, onDone }: { p: Product; group: FieldGroup; editing: boolean; canEdit: boolean; onEdit: () => void; onDone: () => void }) {
  const users = useStore((s) => s.db.users)
  const fields = fieldsIn(group)
  const [draft, setDraft] = useState<Record<string, string | string[]> | null>(null)
  const current = () => Object.fromEntries(fields.map((f) => [f.key, structuredClone(getValue(p, f.key))]))
  const d = editing ? draft ?? current() : null
  const close = () => { setDraft(null); onDone() }
  const save = () => {
    if (!d) return
    const patch = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.trim()).filter(Boolean) : typeof v === 'string' ? v.trim() : v]))
    if (!String(patch.name ?? 'x').trim()) return
    saveGlobal(p.id, patch as GlobalPatch)
    close()
  }
  const filled = fields.filter((f) => !isEmptyValue(getValue(p, f.key))).length

  return (
    <Card
      className="attr-card"
      title={<>{GROUP_LABEL[group]}<span className="attr-count">{filled} of {fields.length} filled</span></>}
      actions={d ? <>
        <button className="btn btn-secondary btn-sm" onClick={close}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
      </> : canEdit ? <button className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={14} />Edit</button>
        : group === 'copy' ? <span className="muted small lock"><Lock size={14} />Edited by the global team</span> : undefined}
    >
      <dl className="attrs">
        {fields.map((f) => {
          const value = getValue(p, f.key)
          return (
            <div key={f.key} className={`attr${d ? ' attr-edit' : ''}`}>
              <dt>
                <span>{f.label}</span>
                {d && f.hint && <span className="attr-hint">{f.hint}</span>}
              </dt>
              <dd>
                {d ? (
                  <div className="field"><FieldInput f={f} value={d[f.key]} onChange={(v) => setDraft({ ...d, [f.key]: v })} users={users} /></div>
                ) : (
                  <>
                    <AttrValue f={f} value={value} users={users} />
                    {f.group === 'copy' && <CopyButton text={asText(value)} />}
                  </>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </Card>
  )
}

function AttrValue({ f, value, users }: { f: FieldDef; value: string | string[]; users: User[] }) {
  if (isEmptyValue(value)) return <Empty />
  if (f.kind === 'list' && f.group === 'copy') return <CopyValue value={value} />
  if (f.kind === 'list' || f.kind === 'multi') return <span className="tags">{(value as string[]).map((x) => <span className="tag" key={x}>{x}</span>)}</span>
  if (f.kind === 'longtext') return <CopyValue value={value} />
  return <span>{displayValue(f, value, users)}</span>
}

/* ---------------- Side cards ---------------- */

function TodoCard({ p, todos, canEdit, onEdit }: { p: Product; todos: Todo[]; canEdit: boolean; onEdit: (what: 'copy' | 'details') => void }) {
  const essential = todos.filter((t) => t.essential)
  const optional = todos.filter((t) => !t.essential && t.area !== 'markets')
  const markets = todos.filter((t) => t.area === 'markets')
  const item = (t: Todo) => {
    const icon = t.kind === 'update' ? <AlertTriangle size={14} className="warn-text" /> : <Circle size={14} />
    const label = t.area === 'files' ? `${t.label} (file)` : t.label
    const inner = <>{icon}<span>{label}</span></>
    if (t.area === 'markets') return <li key={t.id}><Link className="todo-item" to={`/products/${p.id}/translations/${t.locale}`}>{inner}</Link></li>
    if (t.area === 'files') return <li key={t.id}><Link className="todo-item" to={`/products/${p.id}/files`}>{inner}</Link></li>
    return <li key={t.id}>{canEdit ? <button className="todo-item" onClick={() => onEdit(t.area as 'copy' | 'details')}>{inner}</button> : <span className="todo-item static">{inner}</span>}</li>
  }
  return (
    <Card title={<>To do{essential.length > 0 && <span className="count count-warn">{essential.length}</span>}</>}>
      <div className="todo">
        {essential.length === 0 ? (
          <p className="done-line"><CheckCircle2 size={18} />Everything essential is in place.</p>
        ) : (
          <div className="todo-group">
            <div className="todo-head">Needed before approval</div>
            <ul>{essential.map(item)}</ul>
          </div>
        )}
        {markets.length > 0 && (
          <div className="todo-group">
            <div className="todo-head">{TODO_AREA_LABEL.markets}</div>
            <ul>{markets.map(item)}</ul>
          </div>
        )}
        {optional.length > 0 && (
          <details className="todo-group todo-optional">
            <summary className="todo-head">Nice to have ({optional.length})</summary>
            <ul>{optional.map(item)}</ul>
          </details>
        )}
      </div>
    </Card>
  )
}

/** Proposed changes compared with the last approved version, shown while the content is a draft or in approval. */
function ChangesCard({ p }: { p: Product }) {
  if (p.status.status === 'approved') return null
  const changes = globalChanges(p)
  if (changes.before && !changes.fields.length) return null
  return (
    <Card
      className="changes-card"
      title={p.status.status === 'in_review' ? `Changes to approve (version ${p.content.version + 1})` : 'Changes in this draft'}
      actions={<DiffLegend />}
    >
      <div className="pad">
        <ChangeList changes={changes} />
      </div>
    </Card>
  )
}

function PackshotCard({ p }: { p: Product }) {
  const blobUrls = useStore((s) => s.blobUrls)
  const url = productPackshot(p, blobUrls)
  return (
    <Card title="Packshot" actions={<Link to={`/products/${p.id}/files`} className="link-sm">All files</Link>}>
      {url ? <div className="packshot"><img src={url} alt={`${p.name} packaging`} /></div> : <p className="pad"><Empty text="No packshot yet" /></p>}
    </Card>
  )
}

function MarketsCard({ p }: { p: Product }) {
  return (
    <Card title="Translations" actions={<Link to={`/products/${p.id}/translations`} className="link-sm">Manage</Link>}>
      {p.markets.length === 0 ? (
        <p className="pad"><Empty text="Not sold in any market yet" /></p>
      ) : (
        <ul className="mini-markets">
          {p.markets.map((loc) => (
            <li key={loc}>
              <Link to={`/products/${p.id}/translations/${loc}`} title={marketLabel(loc)}>{marketLabel(loc, true)}</Link>
              <StatusBadge status={marketState(p, loc)} small />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
