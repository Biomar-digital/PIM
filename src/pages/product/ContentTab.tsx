import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCheck, ClipboardCopy, Columns2, FileDown, Globe2, ImageOff, Lock, Pencil } from 'lucide-react'
import type { LocalCopy, LocalField, Meta, Product, User, Variant } from '../../types'
import { LOCAL_FIELDS } from '../../types'
import { COPY_LABEL, GLOBAL, localeLanguage, marketLabel } from '../../data/reference'
import { type LocaleState, approvedGlobal, can, essentialTodos, isOutdated, localeState, todos, variantGaps } from '../../data/rules'
import { createVariant, markReviewed, saveGlobal, saveVariant, toast, transition, useStore, type GlobalPatch } from '../../data/store'
import { ChangeList, DiffLegend, DiffValue, globalChanges, variantChanges } from '../../components/changes'
import { EditActions, SentBackNote, type SaveMode } from '../../components/approval'
import { GROUP_LABEL, fieldsIn, getValue, isEmptyValue, type FieldGroup } from '../../lib/fields'
import { FieldInput } from '../../components/FieldInput'
import { copyText, downloadProductSheet, heroImage, productAsText } from '../../lib/files'
import { Card, CopyButton, Empty, GlobalLock, ListEditor, StatusBadge, UpdatedBy } from '../../components/ui'
import { AttrValue, CopyValue, asText, cleanPatch } from './parts'
import { localeName } from '../../components/Layout'

export const COPY_HINT: Record<LocalField, string> = {
  shortDescription: 'One or two sentences for product cards and listings',
  description: 'The full product text for websites and sales material',
  keyBenefits: 'What the customer gains, one point per line',
  sellingPoints: 'Arguments for sales teams, one point per line',
}

const pickLocal = (c: LocalCopy): LocalCopy => ({ shortDescription: c.shortDescription, description: c.description, keyBenefits: [...c.keyBenefits], sellingPoints: [...c.sellingPoints] })
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export type ContentMode = 'normal' | 'side'

export function ContentTab({ p, user, loc, mode, setMode }: { p: Product; user: User; loc: string; mode: ContentMode; setMode: (m: ContentMode) => void }) {
  if (mode === 'side' && loc !== GLOBAL) return <SideBySide key={`${p.id}-${loc}`} p={p} user={user} loc={loc} />
  return (
    <div className="overview">
      <div className="overview-main">
        <ChangesToApprove p={p} user={user} loc={loc} />
        {loc === GLOBAL
          ? <GlobalCopyCard p={p} user={user} />
          : <LocalCopyCard key={`${p.id}-${loc}`} p={p} user={user} loc={loc} onCompare={() => setMode('side')} />}
        <GlobalGroup p={p} user={user} group="identity" />
        <GlobalGroup p={p} user={user} group="technical" />
        {loc === GLOBAL && <GlobalGroup p={p} user={user} group="management" />}
      </div>
      <aside className="overview-side">
        <HeroCard p={p} />
        <UseCard p={p} loc={loc} />
        {loc === GLOBAL && <MissingCard p={p} />}
      </aside>
    </div>
  )
}

/* ---------------- Approvers: what changed ---------------- */

function ChangesToApprove({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const v = loc === GLOBAL ? null : p.variants[loc]
  const meta = loc === GLOBAL ? p.status : v?.meta
  if (meta?.status !== 'in_review' || !can.approve(user, loc)) return null
  const changes = loc === GLOBAL ? globalChanges(p) : variantChanges(v!)
  return (
    <Card className="changes-card" title={`Changes to approve`} actions={<DiffLegend />}>
      <div className="pad">
        <p className="muted small">Compared with the last approved {loc === GLOBAL ? 'global version' : `${localeName(loc)} version`}. Approve or send back with the buttons at the top.</p>
        <ChangeList changes={changes} local={loc !== GLOBAL} emptyText="No text changes since the last approved version." />
      </div>
    </Card>
  )
}

/* ---------------- Global groups (locked for everyone but the global team) ---------------- */

function GlobalGroup({ p, user, group }: { p: Product; user: User; group: FieldGroup }) {
  const users = useStore((s) => s.db.users)
  const fields = fieldsIn(group)
  const [draft, setDraft] = useState<Record<string, string | string[]> | null>(null)
  const editable = can.editGlobal(user)
  const start = () => setDraft(Object.fromEntries(fields.map((f) => [f.key, structuredClone(getValue(p, f.key))])))
  const save = (mode: SaveMode) => {
    if (!draft) return
    const patch = cleanPatch(draft)
    if (!String(patch.name ?? 'x').trim()) return toast('The product name cannot be empty', 'error')
    saveGlobal(p.id, patch as GlobalPatch, { minor: mode === 'minor' })
    if (mode === 'submit') transition(p.id, GLOBAL, 'in_review')
    setDraft(null)
  }
  const filled = fields.filter((f) => !isEmptyValue(getValue(p, f.key))).length
  return (
    <Card
      className={`attr-card${editable ? '' : ' locked'}`}
      title={<>{GROUP_LABEL[group]}<span className="attr-count">{filled} of {fields.length} filled</span></>}
      actions={<>
        <GlobalLock editable={editable} label={group === 'management' ? 'Global team only' : 'Same in every locale'} />
        {editable && !draft && <button className="btn btn-secondary btn-sm" onClick={start}><Pencil size={14} />Edit</button>}
      </>}
    >
      <dl className="attrs">
        {fields.map((f) => (
          <div key={f.key} className={`attr${draft ? ' attr-edit' : ''}`}>
            <dt><span>{f.label}</span>{draft && f.hint && <span className="attr-hint">{f.hint}</span>}</dt>
            <dd>
              {draft
                ? <div className="field"><FieldInput f={f} value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} users={users} /></div>
                : <>
                  <AttrValue f={f} value={getValue(p, f.key)} users={users} />
                  {f.key === 'tagline' && <CopyButton text={p.content.tagline} />}
                </>}
            </dd>
          </div>
        ))}
      </dl>
      {draft && <EditActions meta={p.status} onCancel={() => setDraft(null)} onSave={save} />}
    </Card>
  )
}

/* ---------------- Marketing copy ---------------- */

/** View and edit marketing copy fields; shared by the global and the local card. */
function CopyFields({ value, draft, setDraft }: { value: LocalCopy; draft: LocalCopy | null; setDraft: (d: LocalCopy) => void }) {
  return (
    <dl className="attrs">
      {LOCAL_FIELDS.map((k) => (
        <div key={k} className={`attr${draft ? ' attr-edit' : ''}`}>
          <dt><span>{COPY_LABEL[k]}</span>{draft && <span className="attr-hint">{COPY_HINT[k]}</span>}</dt>
          <dd>
            {draft
              ? <div className="field"><CopyInput field={k} value={draft[k]} onChange={(v) => setDraft({ ...draft, [k]: v } as LocalCopy)} /></div>
              : <><CopyValue value={value[k]} /><CopyButton text={asText(value[k])} /></>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CopyInput({ field, value, onChange }: { field: LocalField; value: string | string[]; onChange: (v: string | string[]) => void }) {
  if (Array.isArray(value)) return <ListEditor id={`edit-${field}`} value={value} onChange={onChange} multiline placeholder="Add a point and press Enter" />
  const max = field === 'shortDescription' ? 200 : 0
  return (
    <>
      <textarea id={`edit-${field}`} rows={field === 'description' ? 8 : 3} value={value} onChange={(e) => onChange(e.target.value)} />
      {max > 0 && <span className={`counter${value.length > max ? ' over' : ''}`}>{value.length} of {max} characters</span>}
    </>
  )
}

function StatusLine({ meta, version, state }: { meta: Meta; version: number; state?: LocaleState }) {
  return (
    <p className="status-line small">
      <StatusBadge status={state ?? meta.status} small />
      <span className="muted">{version > 0 ? `Approved version ${version}` : 'Never approved'} · last change by <UpdatedBy by={meta.updatedBy} at={meta.updatedAt} /></span>
    </p>
  )
}

function GlobalCopyCard({ p, user }: { p: Product; user: User }) {
  const [draft, setDraft] = useState<LocalCopy | null>(null)
  const editable = can.editGlobal(user)
  const save = (mode: SaveMode) => {
    if (!draft) return
    saveGlobal(p.id, cleanPatch(draft) as GlobalPatch, { minor: mode === 'minor' })
    if (mode === 'submit') transition(p.id, GLOBAL, 'in_review')
    setDraft(null)
  }
  return (
    <Card
      className="attr-card copy-card"
      title={<>Marketing copy<span className="attr-count">Global English, the master text for every locale</span></>}
      actions={editable && !draft ? <button className="btn btn-secondary btn-sm" onClick={() => setDraft(pickLocal(p.content))}><Pencil size={14} />Edit</button> : <GlobalLock editable={editable} label="Global team only" />}
    >
      <div className="pad-x pad-t"><StatusLine meta={p.status} version={p.content.version} /><SentBackNote meta={p.status} /></div>
      <CopyFields value={p.content} draft={draft} setDraft={setDraft} />
      {draft && <EditActions meta={p.status} onCancel={() => setDraft(null)} onSave={save} />}
    </Card>
  )
}

/** Start a local version: from the English text, empty, or by using the English text as it is. */
function VariantStart({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const editable = can.editLocale(user, loc)
  const english = localeLanguage(loc) === 'English'
  return (
    <div className="start-box">
      <Globe2 size={28} aria-hidden />
      <h3>No {english ? 'local' : localeLanguage(loc)} copy for {localeName(loc)} yet</h3>
      <p className="muted small">{editable ? 'Choose how to start. Nothing is shared until it is approved.' : 'The global English text is used until the local team adds a version.'}</p>
      {editable && (
        <div className="row-gap wrap center">
          <button className="btn btn-primary" onClick={() => createVariant(p.id, loc, 'copy')}>Start from the English text</button>
          <button className="btn btn-secondary" onClick={() => createVariant(p.id, loc, 'empty')}>Start empty</button>
          {english && <button className="btn btn-secondary" onClick={() => createVariant(p.id, loc, 'inherit')}>Use the English text as it is</button>}
        </div>
      )}
    </div>
  )
}

/** Banner on local copy written against an older global version */
function ReviewBanner({ p, v, user, loc, onCompare }: { p: Product; v: Variant; user: User; loc: string; onCompare?: () => void }) {
  if (!isOutdated(p, v)) return null
  const editable = can.editLocale(user, loc)
  return (
    <div className="note note-update">
      <AlertTriangle size={18} />
      <div className="grow">
        <strong>The global content changed after this copy was written.</strong>{' '}
        It was written against global version {v.sourceVersion}; the latest is version {p.content.version}. Check whether the {localeLanguage(loc)} copy needs the same change. It is not changed automatically.
        {editable && (
          <div className="row-gap wrap mt-sm">
            {onCompare && <button className="btn btn-secondary btn-sm" onClick={onCompare}><Columns2 size={14} />Compare side by side</button>}
            <button className="btn btn-secondary btn-sm" onClick={() => markReviewed(p.id, loc)}><CheckCheck size={14} />No change needed</button>
          </div>
        )}
      </div>
    </div>
  )
}

function LocalCopyCard({ p, user, loc, onCompare }: { p: Product; user: User; loc: string; onCompare: () => void }) {
  const v = p.variants[loc]
  const [draft, setDraft] = useState<LocalCopy | null>(null)
  const editable = can.editLocale(user, loc)
  const title = <>Marketing copy<span className="attr-count">{marketLabel(loc)}</span></>
  if (!v) return <Card className="attr-card copy-card" title={title}><VariantStart p={p} user={user} loc={loc} /></Card>
  const save = (mode: SaveMode) => {
    if (!draft) return
    saveVariant(p.id, loc, cleanPatch(draft), { minor: mode === 'minor' })
    if (mode === 'submit') transition(p.id, loc, 'in_review')
    setDraft(null)
  }
  const english = approvedGlobal(p).copy
  return (
    <Card
      className="attr-card copy-card"
      title={title}
      actions={<>
        {editable && !draft && !v.inheritsGlobal && <button className="btn btn-secondary btn-sm" onClick={() => setDraft(pickLocal(v))}><Pencil size={14} />Edit</button>}
      </>}
    >
      <div className="pad-x pad-t">
        <StatusLine meta={v.meta} version={v.version} state={localeState(p, loc)} />
        <SentBackNote meta={v.meta} />
        <ReviewBanner p={p} v={v} user={user} loc={loc} onCompare={onCompare} />
        {v.inheritsGlobal && (
          <div className="note">
            <Globe2 size={18} />
            <div className="grow">{localeName(loc)} uses the global English copy as it is, so it is always up to date.
              {editable && <> <button className="link-btn" onClick={() => saveVariant(p.id, loc, { inheritsGlobal: false, ...pickLocal(english) })}>Write local copy instead</button></>}
            </div>
          </div>
        )}
      </div>
      <CopyFields value={v.inheritsGlobal ? english : v} draft={draft} setDraft={setDraft} />
      {draft && <EditActions meta={v.meta} onCancel={() => setDraft(null)} onSave={save} />}
    </Card>
  )
}

/* ---------------- Side by side ---------------- */

/** Global English (approved, read only) on the left, the local copy (editable) on the right, field by field. */
function SideBySide({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const v = p.variants[loc]
  const editable = can.editLocale(user, loc) && !!v && !v.inheritsGlobal
  const [draft, setDraft] = useState<LocalCopy | null>(v ? pickLocal(v) : null)
  const [highlight, setHighlight] = useState(true)
  const g = approvedGlobal(p)
  if (!v) return <Card><VariantStart p={p} user={user} loc={loc} /></Card>
  const current = pickLocal(v)
  const d = draft ?? current
  const dirty = editable && !same(cleanPatch(d), current)
  const outdated = isOutdated(p, v)
  const base = outdated ? p.versions?.[v.sourceVersion] : undefined
  const save = (mode: SaveMode) => {
    saveVariant(p.id, loc, cleanPatch(d), { minor: mode === 'minor' })
    if (mode === 'submit') transition(p.id, loc, 'in_review')
  }
  const gaps = variantGaps({ ...v, ...cleanPatch(d) })

  return (
    <div className="sbs">
      <div className="sbs-notes">
        <SentBackNote meta={v.meta} />
        <ReviewBanner p={p} v={v} user={user} loc={loc} />
      </div>
      <div className="sbs-grid card">
        <div className="sbs-head">
          <div>
            <span className="sbs-side-label"><Lock size={13} />Global English</span>
            <span className="muted small">{g.approved ? `Approved version ${g.version}` : 'Not approved yet'} · read only</span>
            {base && <label className="check small sbs-hl"><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />Highlight changes since version {v.sourceVersion}</label>}
          </div>
          <div>
            <span className="sbs-side-label">{marketLabel(loc)}</span>
            <span className="row-gap small"><StatusBadge status={localeState(p, loc)} small /><span className="muted">{editable ? 'Write or edit your local copy here' : v.inheritsGlobal ? 'Uses the English text as it is' : 'Read only'}</span></span>
          </div>
        </div>

        <div className="sbs-row sbs-locked">
          <div className="sbs-label"><span>Tagline</span><GlobalLock label="Same in every locale, not translated" /></div>
          <div className="sbs-cell sbs-span">{p.content.tagline ? <span className="tagline-value">{p.content.tagline}</span> : <Empty />}<CopyButton text={p.content.tagline} /></div>
        </div>

        {LOCAL_FIELDS.map((k) => {
          const changed = base && JSON.stringify(base[k]) !== JSON.stringify(g.copy[k])
          return (
            <div key={k} className={`sbs-row${changed ? ' sbs-changed' : ''}`}>
              <div className="sbs-label">
                <span>{COPY_LABEL[k]}</span>
                {changed && <span className="changed-tag">Changed in English</span>}
              </div>
              <div className="sbs-cell sbs-left">
                {changed && highlight ? <DiffValue before={base![k]} after={g.copy[k]} /> : <CopyValue value={g.copy[k]} />}
                <div className="sbs-tools">
                  <CopyButton text={asText(g.copy[k])} label="Copy English" />
                  {editable && !isEmptyValue(g.copy[k]) && <button className="copy-btn" onClick={() => setDraft({ ...d, [k]: structuredClone(g.copy[k]) } as LocalCopy)} title="Replace the local text with the English text"><ArrowRight size={14} />Use in {localeName(loc)}</button>}
                </div>
              </div>
              <div className="sbs-cell sbs-right">
                {editable
                  ? <div className="field"><CopyInput field={k} value={d[k]} onChange={(val) => setDraft({ ...d, [k]: val } as LocalCopy)} /></div>
                  : <CopyValue value={v.inheritsGlobal ? g.copy[k] : v[k]} />}
                {!editable && <div className="sbs-tools"><CopyButton text={asText(v.inheritsGlobal ? g.copy[k] : v[k])} /></div>}
              </div>
            </div>
          )
        })}
      </div>

      {editable && (
        <div className={`sbs-bar${dirty ? ' dirty' : ''}`}>
          {dirty
            ? <EditActions meta={v.meta} onCancel={() => setDraft(current)} onSave={save} />
            : <p className="muted small">{gaps.length ? `Still to add: ${gaps.join(', ')}.` : 'All changes saved.'} {v.meta.status === 'draft' && !gaps.length && 'Send it for approval with the button at the top when it is ready.'}</p>}
        </div>
      )}
    </div>
  )
}

/* ---------------- Side cards ---------------- */

function HeroCard({ p }: { p: Product }) {
  const hero = heroImage(p)
  return (
    <Card title="Hero image" actions={<GlobalLock label="Global" />}>
      <div className="hero-box">
        {hero ? <img src={hero.url} alt={`${p.name} ${p.species}`} /> : <div className="hero-empty"><ImageOff size={28} /><span>No hero image yet</span></div>}
      </div>
      {hero && !hero.isHero && <p className="muted small pad-x">No hero image linked yet. The bag design is shown instead.</p>}
      <p className="pad-x small"><Link to={`/products/${p.id}/assets`} className="link-sm">All assets</Link></p>
    </Card>
  )
}

function UseCard({ p, loc }: { p: Product; loc: string }) {
  return (
    <Card title="Use this content">
      <div className="pad stack-gap-sm">
        <p className="muted small">The latest approved text{loc === GLOBAL ? '' : ` for ${localeName(loc)}`}, ready for presentations, brochures and websites.</p>
        <button className="btn btn-secondary" onClick={async () => toast((await copyText(productAsText(p, loc))) ? 'Approved text copied' : 'Copy is blocked here', 'info')}><ClipboardCopy size={16} />Copy all approved text</button>
        <button className="btn btn-secondary" onClick={() => downloadProductSheet(p, loc)}><FileDown size={16} />Download product sheet (PDF)</button>
      </div>
    </Card>
  )
}

function MissingCard({ p }: { p: Product }) {
  const t = todos(p)
  const essential = essentialTodos(p)
  if (!t.length) return null
  return (
    <Card title="Still missing">
      <div className="pad">
        {essential.length > 0 && <>
          <p className="small strong">Needed before the product is ready to use</p>
          <ul className="bullets small">{essential.map((x) => <li key={x.id}>{x.label}</li>)}</ul>
        </>}
        {t.length > essential.length && <>
          <p className="small strong mt-sm">Nice to have</p>
          <ul className="bullets small muted">{t.filter((x) => !x.essential).map((x) => <li key={x.id}>{x.label}</li>)}</ul>
        </>}
      </div>
    </Card>
  )
}
