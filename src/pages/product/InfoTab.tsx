import { useState, type ReactNode } from 'react'
import { Lock, Pencil } from 'lucide-react'
import type { InfoField, Product, User } from '../../types'
import { can } from '../../data/rules'
import { saveInfo, saveVariant, useStore } from '../../data/store'
import { CATEGORIES, FEED_TYPES, LIFECYCLE_LABEL, RANGES, SPECIES, STAGES, marketLabel } from '../../data/reference'
import { Card, ListEditor } from '../../components/ui'
import { NoVariant } from './MarketingTab'

type InfoDraft = Pick<Product, InfoField>

export function InfoTab({ p, user, context }: { p: Product; user: User; context: string }) {
  const users = useStore((s) => s.db.users)
  const [draft, setDraft] = useState<InfoDraft | null>(null)
  const canEdit = can.editGlobal(user)
  const local = context !== 'global'

  const start = () => setDraft({
    name: p.name, species: p.species, range: p.range, category: p.category, stages: [...p.stages], feedType: p.feedType,
    pelletSizes: [...p.pelletSizes], packaging: [...p.packaging], code: p.code, owner: p.owner, lifecycle: p.lifecycle, regulatoryNotes: p.regulatoryNotes,
  })
  const save = () => { if (draft) { saveInfo(p.id, draft); setDraft(null) } }

  if (draft) {
    const set = <K extends InfoField>(k: K, v: InfoDraft[K]) => setDraft({ ...draft, [k]: v })
    return (
      <Card title="Edit product information" actions={<>
        <button className="btn btn-secondary btn-sm" onClick={() => setDraft(null)}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save}>Save draft</button>
      </>}>
        <div className="form-grid pad">
          <label className="field"><span>Product name</span><input value={draft.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="field"><span>Product code</span><input value={draft.code} onChange={(e) => set('code', e.target.value)} /></label>
          <label className="field"><span>Species</span><select value={draft.species} onChange={(e) => set('species', e.target.value)}>{[...new Set([draft.species, ...SPECIES])].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Product range</span><select value={draft.range} onChange={(e) => set('range', e.target.value)}>{[...new Set([draft.range, ...RANGES])].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Category</span><select value={draft.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Feed type</span><select value={draft.feedType} onChange={(e) => set('feedType', e.target.value)}>{FEED_TYPES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <fieldset className="field span-2">
            <legend>Production stage</legend>
            <div className="checks">
              {STAGES.map((s) => (
                <label key={s} className="check"><input type="checkbox" checked={draft.stages.includes(s)} onChange={(e) => set('stages', e.target.checked ? STAGES.filter((x) => x === s || draft.stages.includes(x)) : draft.stages.filter((x) => x !== s))} />{s}</label>
              ))}
            </div>
          </fieldset>
          <div className="field"><span>Pellet sizes</span><ListEditor value={draft.pelletSizes} onChange={(v) => set('pelletSizes', v)} placeholder="e.g. 4.5 mm" /></div>
          <div className="field"><span>Packaging</span><ListEditor value={draft.packaging} onChange={(v) => set('packaging', v)} placeholder="e.g. 25 kg bag" /></div>
          <label className="field"><span>Product owner</span><select value={draft.owner} onChange={(e) => set('owner', e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="field"><span>Lifecycle</span><select value={draft.lifecycle} onChange={(e) => set('lifecycle', e.target.value as Product['lifecycle'])}>{Object.entries(LIFECYCLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field span-2"><span>Regulatory / internal notes</span><textarea rows={3} value={draft.regulatoryNotes} onChange={(e) => set('regulatoryNotes', e.target.value)} /></label>
        </div>
      </Card>
    )
  }

  const users_ = Object.fromEntries(users.map((u) => [u.id, u.name]))
  const rows: [string, ReactNode][] = [
    ['Product name', p.name],
    ['Product code', p.code],
    ['Product range', p.range],
    ['Category', p.category],
    ['Species', p.species],
    ['Production stage', p.stages.join(', ')],
    ['Feed type', p.feedType],
    ['Pellet sizes', p.pelletSizes.length ? <span className="tags">{p.pelletSizes.map((s) => <span className="tag" key={s}>{s}</span>)}</span> : null],
    ['Packaging', p.packaging.length ? <span className="tags">{p.packaging.map((s) => <span className="tag" key={s}>{s}</span>)}</span> : null],
    ['Lifecycle', LIFECYCLE_LABEL[p.lifecycle]],
    ['Product owner', users_[p.owner] ?? p.owner],
    ['Regulatory / internal notes', p.regulatoryNotes || <span className="muted">—</span>],
  ]

  return (
    <div className="stack-gap">
      {local && <LocalInfo p={p} user={user} context={context} />}
      <Card
        title={local ? 'Global product information' : 'Product information'}
        actions={canEdit ? <button className="btn btn-secondary btn-sm" onClick={start}><Pencil size={14} /> Edit</button> : <span className="muted small lock"><Lock size={14} /> Managed by global editors</span>}
      >
        {local && <p className="pad-x small muted">Product information is shared by all markets and maintained globally.</p>}
        <dl className="dl">
          {rows.map(([k, v]) => (
            <div key={k} className="dl-row">
              <dt>{k}</dt>
              <dd>{v || <span className="missing">Missing</span>}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}

function LocalInfo({ p, user, context }: { p: Product; user: User; context: string }) {
  const v = p.variants[context]
  const [edit, setEdit] = useState<{ localName: string; notes: string } | null>(null)
  if (!v) return <NoVariant p={p} user={user} context={context} />
  const canEdit = can.editMarket(user, context)
  return (
    <Card title={`Local details – ${marketLabel(context)}`} actions={canEdit && !edit ? <button className="btn btn-secondary btn-sm" onClick={() => setEdit({ localName: v.localName, notes: v.notes })}><Pencil size={14} /> Edit</button> : null}>
      {edit ? (
        <div className="form-grid pad">
          <label className="field"><span>Local product name</span><input value={edit.localName} placeholder={`${p.name} (same as global)`} onChange={(e) => setEdit({ ...edit, localName: e.target.value })} /></label>
          <label className="field span-2"><span>Local notes (availability, regulations, local claims)</span><textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
          <div className="form-actions span-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={() => { saveVariant(p.id, context, edit); setEdit(null) }}>Save draft</button>
          </div>
        </div>
      ) : (
        <dl className="dl">
          <div className="dl-row"><dt>Local product name</dt><dd>{v.localName || <span className="muted">Same as global ({p.name})</span>}</dd></div>
          <div className="dl-row"><dt>Local notes</dt><dd>{v.notes || <span className="muted">—</span>}</dd></div>
        </dl>
      )}
    </Card>
  )
}
