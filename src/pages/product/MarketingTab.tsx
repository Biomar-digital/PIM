import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCheck, Copy, FilePlus2, Globe2, Lock, Pencil } from 'lucide-react'
import type { MarketingField, Product, User, Variant } from '../../types'
import { can, isOutdated, variantMissingFields } from '../../data/rules'
import { createVariant, markVariantUpToDate, saveMarketing, saveVariant, setMarkets } from '../../data/store'
import { marketLabel } from '../../data/reference'
import { Card, EmptyState, ListEditor } from '../../components/ui'
import { SampleTag } from './InfoTab'

const FIELDS: { key: MarketingField; label: string; hint: string; kind: 'line' | 'text' | 'long' | 'list'; max?: number }[] = [
  { key: 'tagline', label: 'Tagline', hint: 'One short line that captures the product promise', kind: 'line', max: 70 },
  { key: 'shortDescription', label: 'Short description', hint: 'Used in product listings and cards', kind: 'text', max: 160 },
  { key: 'description', label: 'Product description', hint: 'Full description for websites and sales material', kind: 'long' },
  { key: 'keyBenefits', label: 'Key benefits', hint: 'At least three customer benefits', kind: 'list' },
  { key: 'sellingPoints', label: 'Selling points', hint: 'Arguments for sales teams – internal', kind: 'list' },
]

type Draft = Record<MarketingField, string | string[]>

export function MarketingTab({ p, user, context }: { p: Product; user: User; context: string }) {
  return context === 'global' ? <GlobalMarketing p={p} user={user} /> : <LocalMarketing p={p} user={user} context={context} />
}

function FieldEditor({ f, value, onChange, placeholder }: { f: (typeof FIELDS)[number]; value: string | string[]; onChange: (v: string | string[]) => void; placeholder?: string }) {
  if (f.kind === 'list') return <ListEditor value={value as string[]} onChange={onChange} multiline placeholder={placeholder ?? 'Add a point and press Enter'} />
  const s = value as string
  return (
    <>
      {f.kind === 'line' ? (
        <input value={s} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <textarea rows={f.kind === 'long' ? 8 : 3} value={s} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {f.max && <span className={`counter${s.length > f.max ? ' over' : ''}`}>{s.length}/{f.max}</span>}
    </>
  )
}

function FieldView({ value, empty }: { value: string | string[]; empty?: ReactNode }) {
  if (Array.isArray(value)) {
    const items = value.filter(Boolean)
    return items.length ? <ul className="bullets">{items.map((b, i) => <li key={i}>{b}</li>)}</ul> : <>{empty ?? <span className="missing">Missing</span>}</>
  }
  return value.trim() ? <div className="prose">{value.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>)}</div> : <>{empty ?? <span className="missing">Missing</span>}</>
}

/* ---------------- Global ---------------- */

function GlobalMarketing({ p, user }: { p: Product; user: User }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const m = p.marketing
  const canEdit = can.editGlobal(user)
  const start = () => setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, Array.isArray(m[f.key]) ? [...(m[f.key] as string[])] : m[f.key]])) as Draft)
  const save = () => {
    if (!draft) return
    saveMarketing(p.id, { tagline: draft.tagline as string, shortDescription: draft.shortDescription as string, description: draft.description as string, keyBenefits: (draft.keyBenefits as string[]).filter(Boolean), sellingPoints: (draft.sellingPoints as string[]).filter(Boolean) })
    setDraft(null)
  }
  const affected = Object.keys(p.variants).filter((l) => !p.variants[l].inheritsGlobal).length

  return (
    <Card
      title={<>Marketing content <span className="muted small">· global English master · v{m.version}</span></>}
      actions={draft ? <>
        <button className="btn btn-secondary btn-sm" onClick={() => setDraft(null)}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save}>Save draft</button>
      </> : canEdit ? <button className="btn btn-secondary btn-sm" onClick={start}><Pencil size={14} /> Edit</button> : <span className="muted small lock"><Lock size={14} /> Managed by global editors</span>}
    >
      {draft && affected > 0 && (
        <div className="note note-info mx"><Globe2 size={16} />When these changes are approved, {affected} local version{affected > 1 ? 's' : ''} will be flagged for review.</div>
      )}
      <div className="fields">
        {FIELDS.map((f) => (
          <div className="mfield" key={f.key}>
            <div className="mfield-head">
              <h3>{f.label}{!draft && p.sampleFields?.includes(f.key) && (m[f.key] as string | string[]).length > 0 && <SampleTag />}</h3>
              <span className="muted small">{f.hint}</span>
            </div>
            {draft ? (
              <div className="field"><FieldEditor f={f} value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} /></div>
            ) : (
              <FieldView value={m[f.key]} />
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- Local ---------------- */

export function NoVariant({ p, user, context }: { p: Product; user: User; context: string }) {
  const canEdit = can.editMarket(user, context)
  const targeted = p.markets.includes(context)
  return (
    <Card>
      <EmptyState icon={<FilePlus2 size={32} />} title={`No ${marketLabel(context)} version yet`}>
        <p className="muted">
          {targeted
            ? `${p.name} is sold in ${marketLabel(context, true)}, but local content has not been added.`
            : `${marketLabel(context, true)} is not a target market for ${p.name}.`}
        </p>
        {canEdit ? (
          <div className="row-gap wrap center">
            <button className="btn btn-primary" onClick={() => createVariant(p.id, context, 'copy')}><Copy size={16} /> Start from global copy</button>
            <button className="btn btn-secondary" onClick={() => createVariant(p.id, context, 'empty')}>Start empty</button>
            <button className="btn btn-secondary" onClick={() => createVariant(p.id, context, 'inherit')}>Use global English as-is</button>
          </div>
        ) : (
          <p className="small muted">Local editors for this market can add it.</p>
        )}
        {!targeted && can.editGlobal(user) && !canEdit && (
          <button className="btn btn-secondary" onClick={() => setMarkets(p.id, context)}>Add as target market</button>
        )}
      </EmptyState>
    </Card>
  )
}

function LocalMarketing({ p, user, context }: { p: Product; user: User; context: string }) {
  const v = p.variants[context]
  const [draft, setDraft] = useState<(Draft & { inheritsGlobal: boolean }) | null>(null)
  if (!v) return <NoVariant p={p} user={user} context={context} />
  const canEdit = can.editMarket(user, context)
  const outdated = isOutdated(p, v)
  const missingFields = variantMissingFields(v)
  const start = () => setDraft({
    ...(Object.fromEntries(FIELDS.map((f) => [f.key, Array.isArray(v[f.key]) ? [...(v[f.key] as string[])] : v[f.key]])) as Draft),
    inheritsGlobal: v.inheritsGlobal,
  })
  const save = () => {
    if (!draft) return
    const patch: Partial<Variant> = { ...(draft as unknown as Partial<Variant>) }
    patch.keyBenefits = (draft.keyBenefits as string[]).filter(Boolean)
    patch.sellingPoints = (draft.sellingPoints as string[]).filter(Boolean)
    saveVariant(p.id, context, patch)
    setDraft(null)
  }
  const inherit = draft ? draft.inheritsGlobal : v.inheritsGlobal

  return (
    <div className="stack-gap">
      {outdated && !draft && (
        <div className="note note-warn">
          <AlertTriangle size={18} />
          <div>
            <strong>Global content has changed.</strong> This version was written against v{v.sourceVersion}; the global master is now v{p.marketing.version}.
            Compare with the global text below and update, or confirm that no local change is needed.
            {canEdit && (
              <div className="row-gap mt">
                <button className="btn btn-primary btn-sm" onClick={start}><Pencil size={14} /> Update translation</button>
                <button className="btn btn-secondary btn-sm" onClick={() => markVariantUpToDate(p.id, context)}><CheckCheck size={14} /> No change needed</button>
              </div>
            )}
          </div>
        </div>
      )}
      {!outdated && missingFields.length > 0 && !draft && (
        <div className="note note-info"><AlertTriangle size={16} />Missing locally: {missingFields.join(', ')}. Empty fields fall back to the global English text.</div>
      )}

      <Card
        title={<>Marketing content <span className="muted small">· {marketLabel(context)}</span></>}
        actions={draft ? <>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save}>Save draft</button>
        </> : canEdit ? <button className="btn btn-secondary btn-sm" onClick={start}><Pencil size={14} /> Edit local version</button> : <span className="muted small lock"><Lock size={14} /> Read only</span>}
      >
        <div className="pad-x pad-t">
          {draft ? (
            <label className="check">
              <input type="checkbox" checked={draft.inheritsGlobal} onChange={(e) => setDraft({ ...draft, inheritsGlobal: e.target.checked })} />
              This market uses the global English copy as-is (no translation needed)
            </label>
          ) : inherit ? (
            <div className="note note-info"><Globe2 size={16} />This market uses the global English copy as-is.</div>
          ) : null}
        </div>
        <div className="compare-head">
          <span>Global master · v{p.marketing.version}</span>
          <span>{marketLabel(context)}</span>
        </div>
        <div className="fields">
          {FIELDS.map((f) => (
            <div className="compare" key={f.key}>
              <h3 className="compare-label">{f.label}</h3>
              <div className="compare-global"><FieldView value={p.marketing[f.key]} empty={<span className="muted">—</span>} /></div>
              <div className="compare-local">
                {draft && !draft.inheritsGlobal ? (
                  <div className="field"><FieldEditor f={f} value={draft[f.key]} onChange={(val) => setDraft({ ...draft, [f.key]: val })} placeholder="Leave empty to use the global text" /></div>
                ) : inherit ? (
                  <span className="tag">Uses global</span>
                ) : (
                  <FieldView value={v[f.key]} empty={<span className="tag tag-muted">Uses global</span>} />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
