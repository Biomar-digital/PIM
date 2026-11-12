import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Circle, Lock, Pencil } from 'lucide-react'
import type { Copy, CopyField, DetailField, Product, User } from '../../types'
import { COPY_FIELDS } from '../../types'
import { TODO_AREA_LABEL, can, marketState, type Todo, type TodoArea } from '../../data/rules'
import { saveGlobal, useStore } from '../../data/store'
import { CATEGORIES, COPY_LABEL, FEED_TYPES, LIFECYCLE_LABEL, RANGES, SPECIES, STAGES, marketLabel } from '../../data/reference'
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

type Editing = null | 'copy' | 'details'

export function Overview({ p, user, todos }: { p: Product; user: User; todos: Todo[] }) {
  const [editing, setEditing] = useState<Editing>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const canEdit = can.editGlobal(user)
  const startEdit = (what: 'copy' | 'details') => {
    if (!canEdit) return
    setEditing(what)
    ;(what === 'copy' ? copyRef : detailsRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="overview">
      <div className="overview-main">
        <div ref={copyRef}><CopyCard p={p} editing={editing === 'copy'} canEdit={canEdit} onEdit={() => setEditing('copy')} onDone={() => setEditing(null)} /></div>
        <div ref={detailsRef}><DetailsCard p={p} editing={editing === 'details'} canEdit={canEdit} onEdit={() => setEditing('details')} onDone={() => setEditing(null)} /></div>
      </div>
      <aside className="overview-side">
        <TodoCard p={p} todos={todos} canEdit={canEdit} onEdit={startEdit} />
        <PackshotCard p={p} />
        <MarketsCard p={p} />
      </aside>
    </div>
  )
}

/* ---------------- Marketing copy ---------------- */

function CopyCard({ p, editing, canEdit, onEdit, onDone }: { p: Product; editing: boolean; canEdit: boolean; onEdit: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState<Copy | null>(null)
  const c = p.content
  const d = editing ? draft ?? { ...c, keyBenefits: [...c.keyBenefits], sellingPoints: [...c.sellingPoints] } : null
  const close = () => { setDraft(null); onDone() }
  const save = () => {
    if (d) saveGlobal(p.id, { ...d, keyBenefits: d.keyBenefits.filter(Boolean), sellingPoints: d.sellingPoints.filter(Boolean) })
    close()
  }
  return (
    <Card
      title="Marketing copy"
      actions={d ? <>
        <button className="btn btn-secondary btn-sm" onClick={close}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
      </> : canEdit ? <button className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={14} />Edit</button> : <span className="muted small lock"><Lock size={14} />Edited by the global team</span>}
    >
      <div className="fields">
        {COPY_FIELDS.map((f) => (
          <div className="mfield" key={f}>
            <div className="mfield-head">
              <h3>{COPY_LABEL[f]}</h3>
              {d ? <span className="muted small">{COPY_HINT[f]}</span> : <CopyButton text={asText(c[f])} />}
            </div>
            {d ? (
              <div className="field"><CopyInput field={f} value={d[f]} onChange={(v) => setDraft({ ...d, [f]: v })} /></div>
            ) : (
              <CopyValue value={c[f]} />
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- Product details ---------------- */

type DetailsDraft = Pick<Product, DetailField>

function DetailsCard({ p, editing, canEdit, onEdit, onDone }: { p: Product; editing: boolean; canEdit: boolean; onEdit: () => void; onDone: () => void }) {
  const users = useStore((s) => s.db.users)
  const [draft, setDraft] = useState<DetailsDraft | null>(null)
  const d: DetailsDraft | null = editing
    ? draft ?? { name: p.name, species: p.species, range: p.range, categories: [...p.categories], stages: [...p.stages], code: p.code, feedType: p.feedType, pelletSizes: [...p.pelletSizes], packaging: [...p.packaging], owner: p.owner, lifecycle: p.lifecycle, notes: p.notes }
    : null
  const close = () => { setDraft(null); onDone() }
  const set = <K extends DetailField>(k: K, v: DetailsDraft[K]) => d && setDraft({ ...d, [k]: v })
  const toggle = (list: string[], v: string, on: boolean, order: string[]) => (on ? order.filter((x) => x === v || list.includes(x)) : list.filter((x) => x !== v))
  const tags = (list: string[]) => (list.length ? <span className="tags">{list.map((x) => <span className="tag" key={x}>{x}</span>)}</span> : <Empty />)

  const rows: [string, ReactNode][] = [
    ['Product name', p.name],
    ['Species', p.species],
    ['Range', p.range],
    ['Category', tags(p.categories)],
    ['Production stage', tags(p.stages)],
    ['Product code', p.code || <Empty />],
    ['Feed type', p.feedType || <Empty />],
    ['Pellet sizes', tags(p.pelletSizes)],
    ['Packaging', tags(p.packaging)],
    ['Owner', users.find((u) => u.id === p.owner)?.name ?? <Empty />],
    ['Lifecycle', LIFECYCLE_LABEL[p.lifecycle]],
    ['Internal notes', p.notes || <Empty text="None" />],
  ]

  return (
    <Card
      title="Product details"
      actions={d ? <>
        <button className="btn btn-secondary btn-sm" onClick={close}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={() => { saveGlobal(p.id, d); close() }}>Save</button>
      </> : canEdit ? <button className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={14} />Edit</button> : undefined}
    >
      {d ? (
        <div className="form-grid pad">
          <label className="field"><span>Product name</span><input id="d-name" value={d.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="field"><span>Product code</span><input id="d-code" value={d.code} placeholder="For example 2345-0045" onChange={(e) => set('code', e.target.value)} /></label>
          <label className="field"><span>Species</span><select id="d-species" value={d.species} onChange={(e) => set('species', e.target.value)}>{[...new Set([d.species, ...SPECIES])].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Range</span><select id="d-range" value={d.range} onChange={(e) => set('range', e.target.value)}>{[...new Set([d.range, ...RANGES])].map((s) => <option key={s}>{s}</option>)}</select></label>
          <fieldset className="field span-2"><legend>Category</legend>
            <div className="checks">{CATEGORIES.map((c) => <label key={c} className="check"><input type="checkbox" checked={d.categories.includes(c)} onChange={(e) => set('categories', toggle(d.categories, c, e.target.checked, CATEGORIES))} />{c}</label>)}</div>
          </fieldset>
          <fieldset className="field span-2"><legend>Production stage</legend>
            <div className="checks">{STAGES.map((s) => <label key={s} className="check"><input type="checkbox" checked={d.stages.includes(s)} onChange={(e) => set('stages', toggle(d.stages, s, e.target.checked, STAGES))} />{s}</label>)}</div>
          </fieldset>
          <label className="field"><span>Feed type</span><select id="d-feed" value={d.feedType} onChange={(e) => set('feedType', e.target.value)}><option value="">Not set</option>{FEED_TYPES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Owner</span><select id="d-owner" value={d.owner} onChange={(e) => set('owner', e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <div className="field"><span>Pellet sizes</span><ListEditor id="d-pellets" value={d.pelletSizes} onChange={(v) => set('pelletSizes', v)} placeholder="For example 4.5 mm" /></div>
          <div className="field"><span>Packaging</span><ListEditor id="d-packaging" value={d.packaging} onChange={(v) => set('packaging', v)} placeholder="For example 25 kg bag" /></div>
          <label className="field"><span>Lifecycle</span><select id="d-lifecycle" value={d.lifecycle} onChange={(e) => set('lifecycle', e.target.value as Product['lifecycle'])}>{Object.entries(LIFECYCLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field span-2"><span>Internal notes</span><textarea id="d-notes" rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything colleagues should know, for example regulatory remarks" /></label>
        </div>
      ) : (
        <dl className="dl">
          {rows.map(([k, v]) => <div key={k} className="dl-row"><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
    </Card>
  )
}

/* ---------------- Side cards ---------------- */

const AREA_ORDER: TodoArea[] = ['copy', 'details', 'files', 'markets']

function TodoCard({ p, todos, canEdit, onEdit }: { p: Product; todos: Todo[]; canEdit: boolean; onEdit: (what: 'copy' | 'details') => void }) {
  if (!todos.length) {
    return (
      <Card title="To do">
        <p className="pad done-line"><CheckCircle2 size={18} />Everything is in place.</p>
      </Card>
    )
  }
  return (
    <Card title={<>To do <span className="count">{todos.length}</span></>}>
      <div className="todo">
        {AREA_ORDER.map((area) => {
          const items = todos.filter((t) => t.area === area)
          if (!items.length) return null
          return (
            <div key={area} className="todo-group">
              <div className="todo-head">{TODO_AREA_LABEL[area]}</div>
              <ul>
                {items.map((t) => {
                  const icon = t.kind === 'update' ? <AlertTriangle size={14} className="warn-text" /> : <Circle size={14} />
                  const inner = <>{icon}<span>{t.label}</span></>
                  if (area === 'markets') return <li key={t.id}><Link className="todo-item" to={`/products/${p.id}/translations/${t.locale}`}>{inner}</Link></li>
                  if (area === 'files') return <li key={t.id}><Link className="todo-item" to={`/products/${p.id}/files`}>{inner}</Link></li>
                  return (
                    <li key={t.id}>
                      {canEdit ? <button className="todo-item" onClick={() => onEdit(area as 'copy' | 'details')}>{inner}</button> : <span className="todo-item static">{inner}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
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
