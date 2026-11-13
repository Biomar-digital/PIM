import { useState } from 'react'
import { Lock, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import type { AssetType, InternalNote, InternalSection, MarketAvailability, MarketInfo, Product, User } from '../../types'
import { GLOBAL, MARKETS, marketLabel } from '../../data/reference'
import { can, editableLocales } from '../../data/rules'
import { removeNote, saveMarketInfo, saveNote, useStore } from '../../data/store'
import { Card, Empty, GlobalLock, ListEditor, Modal, UpdatedBy } from '../../components/ui'
import { GUIDELINES, RANGE_CONCEPTS, type RangeConcept } from '../../data/brandGuidelines'
import { LocaleCode, localeName } from '../../components/Layout'
import { ResourceList, ResourceModal, addableTypes } from '../../components/resources'
import { GlobalGroup } from './ContentTab'
import { CopyValue } from './parts'

/** Sections for notes and documents, with the content types whose files show in each */
const SECTIONS: { id: InternalSection; title: string; types: AssetType[]; fileType?: AssetType }[] = [
  { id: 'presentations', title: 'Internal presentations', types: ['presentation'], fileType: 'presentation' },
  { id: 'technical', title: 'Technical information and notes', types: ['datasheet', 'spreadsheet'], fileType: 'datasheet' },
  { id: 'trials', title: 'Trials and results', types: ['trial'], fileType: 'trial' },
  { id: 'positioning', title: 'Internal selling points and positioning', types: [] },
  { id: 'other', title: 'Other information', types: ['document'], fileType: 'document' },
]

export const AVAILABILITY_LABEL: Record<MarketAvailability, string> = {
  '': 'Not set', available: 'Available', on_request: 'On request', phasing_out: 'Phasing out', not_sold: 'Not sold',
}

/** Scopes this person may write internal information for */
const writableScopes = (user: User) => [...(can.editGlobal(user) ? [GLOBAL] : []), ...editableLocales(user)]

/**
 * Internal information: not published, for marketing, product and sales teams.
 * Global information applies everywhere; market information is marked with its market.
 * In a market you see the global information and that market's own.
 */
export function InternalTab({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const visible = (scope: string) => loc === GLOBAL || scope === GLOBAL || scope === loc
  const notes = (p.internal?.notes ?? []).filter((n) => visible(n.scope))
  return (
    <div className="internal">
      <div className="note internal-intro">
        <Lock size={18} />
        <div>For internal use. Nothing here is published on the website. Items marked <span className="scope-tag global">Global</span> apply to every market; market items show their market.{loc !== GLOBAL && <> You see the global information and {localeName(loc)}.</>}</div>
      </div>
      <GlobalGroup p={p} user={user} group="technical" title="Pellet sizes, formats and technical details" />
      <Availability p={p} user={user} loc={loc} />
      {SECTIONS.map((s) => (
        <NotesSection key={s.id} p={p} user={user} loc={loc} section={s} notes={notes.filter((n) => n.section === s.id)}
          files={p.assets.filter((a) => s.types.includes(a.type) && visible(a.scope))} />
      ))}
      {loc === GLOBAL && <GlobalGroup p={p} user={user} group="management" />}
    </div>
  )
}

/* ---------------- Availability by market ---------------- */

function Availability({ p, user, loc }: { p: Product; user: User; loc: string }) {
  const [editing, setEditing] = useState<string | null>(null)
  const markets = MARKETS.filter((m) => p.markets.includes(m.id) && (loc === GLOBAL || m.id === loc))
  const info = p.internal?.markets ?? {}
  return (
    <Card className="attr-card" title={<>Availability by market<span className="attr-count">Pellet sizes and formats sold in each market</span></>}>
      {markets.length === 0 ? <p className="pad muted small"><Empty text={loc === GLOBAL ? 'Not available in any market yet.' : `Not available in ${localeName(loc)}.`} /></p> : (
        <div className="table-wrap">
          <table className="table avail-table">
            <thead><tr><th>Market</th><th>Availability</th><th>Pellet sizes</th><th>Formats</th><th className="hide-md">Notes</th><th /></tr></thead>
            <tbody>
              {markets.map((m) => {
                const i = info[m.id]
                return (
                  <tr key={m.id}>
                    <td><span className="row-gap"><LocaleCode id={m.id} /><strong>{m.market}</strong></span></td>
                    <td>{i?.status ? <span className={`avail avail-${i.status}`}>{AVAILABILITY_LABEL[i.status]}</span> : <Empty />}</td>
                    <td>{i?.pelletSizes.length ? <span className="tags">{i.pelletSizes.map((x) => <span key={x} className="tag">{x}</span>)}</span> : <Empty />}</td>
                    <td>{i?.packaging.length ? <span className="tags">{i.packaging.map((x) => <span key={x} className="tag">{x}</span>)}</span> : <Empty />}</td>
                    <td className="hide-md small">{i?.notes || <Empty />}</td>
                    <td className="right">{can.editLocale(user, m.id) && <button className="icon-btn" onClick={() => setEditing(m.id)} aria-label={`Edit ${m.market}`} title="Edit"><Pencil size={16} /></button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <MarketModal p={p} locale={editing} current={info[editing]} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function MarketModal({ p, locale, current, onClose }: { p: Product; locale: string; current?: MarketInfo; onClose: () => void }) {
  const [status, setStatus] = useState<MarketAvailability>(current?.status ?? '')
  const [sizes, setSizes] = useState<string[]>(current?.pelletSizes ?? [])
  const [packs, setPacks] = useState<string[]>(current?.packaging ?? [])
  const [notes, setNotes] = useState(current?.notes ?? '')
  const clean = (l: string[]) => l.map((x) => x.trim()).filter(Boolean)
  return (
    <Modal title={`${marketLabel(locale, true)}: availability and formats`} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={() => { saveMarketInfo(p.id, locale, { status, pelletSizes: clean(sizes), packaging: clean(packs), notes: notes.trim() }); onClose() }}>Save</button>
    </>}>
      <label className="field"><span>Availability</span>
        <select id="market-status" value={status} onChange={(e) => setStatus(e.target.value as MarketAvailability)}>
          {(Object.keys(AVAILABILITY_LABEL) as MarketAvailability[]).map((k) => <option key={k} value={k}>{AVAILABILITY_LABEL[k]}</option>)}
        </select>
      </label>
      <div className="field">
        <span>Pellet sizes sold in this market</span>
        <ListEditor id="market-sizes" value={sizes} onChange={setSizes} placeholder="For example 4.5 mm, then Enter" />
        {p.pelletSizes.length > 0 && <button className="link-btn small" onClick={() => setSizes([...p.pelletSizes])}>Use the global list ({p.pelletSizes.join(', ')})</button>}
      </div>
      <div className="field">
        <span>Formats and packaging sold in this market</span>
        <ListEditor id="market-packs" value={packs} onChange={setPacks} placeholder="For example 25 kg bag, then Enter" />
        {p.packaging.length > 0 && <button className="link-btn small" onClick={() => setPacks([...p.packaging])}>Use the global list ({p.packaging.join(', ')})</button>}
      </div>
      <label className="field"><span>Notes</span>
        <textarea id="market-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
    </Modal>
  )
}

/* ---------------- Notes and documents ---------------- */

function NotesSection({ p, user, loc, section, notes, files }: {
  p: Product
  user: User
  loc: string
  section: (typeof SECTIONS)[number]
  notes: InternalNote[]
  files: Product['assets']
}) {
  const [editing, setEditing] = useState<InternalNote | 'new' | null>(null)
  const [addingFile, setAddingFile] = useState(false)
  const [removing, setRemoving] = useState<InternalNote | null>(null)
  const attached = new Set(notes.flatMap((n) => n.resourceIds))
  const loose = files.filter((f) => !attached.has(f.id))
  const canWrite = writableScopes(user).some((s) => loc === GLOBAL || s === GLOBAL || s === loc)
  const canFile = !!section.fileType && addableTypes(user).some((t) => t.id === section.fileType)
  const concept = section.id === 'positioning' ? RANGE_CONCEPTS[p.range] : undefined
  const empty = notes.length === 0 && loose.length === 0 && !concept
  return (
    <Card className="attr-card internal-section"
      title={<>{section.title}{notes.length + loose.length > 0 && <span className="count-pill">{notes.length + loose.length}</span>}</>}
      actions={<>
        {canFile && <button className="btn btn-secondary btn-sm" onClick={() => setAddingFile(true)}><Paperclip size={14} />Add file</button>}
        {canWrite && <button className="btn btn-secondary btn-sm" onClick={() => setEditing('new')}><Plus size={14} />Add note</button>}
      </>}>
      {empty && <p className="pad muted small"><Empty text="Nothing added yet" /></p>}
      {concept && <RangeConceptBlock range={p.range} c={concept} />}
      {notes.map((n) => {
        const manage = can.editLocale(user, n.scope)
        const items = n.resourceIds.map((id) => p.assets.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a)
        return (
          <article key={n.id} className="inote">
            <header className="inote-head">
              <span className={`scope-tag${n.scope === GLOBAL ? ' global' : ''}`}>{n.scope === GLOBAL ? 'Global' : marketLabel(n.scope, true)}</span>
              <h3>{n.title}</h3>
              {manage && <span className="inote-actions">
                <button className="icon-btn" onClick={() => setEditing(n)} aria-label={`Edit ${n.title}`} title="Edit"><Pencil size={15} /></button>
                <button className="icon-btn danger" onClick={() => setRemoving(n)} aria-label={`Remove ${n.title}`} title="Remove"><Trash2 size={15} /></button>
              </span>}
            </header>
            {n.body && <CopyValue value={n.body} />}
            {items.length > 0 && <ResourceList user={user} items={items} compact />}
            <p className="muted small"><UpdatedBy by={n.updatedBy} at={n.updatedAt} /></p>
          </article>
        )
      })}
      {loose.length > 0 && <ResourceList user={user} items={loose} compact />}
      {editing && <NoteModal p={p} user={user} loc={loc} section={section.id} note={editing === 'new' ? undefined : editing} fileType={section.fileType} onClose={() => setEditing(null)} />}
      {addingFile && <ResourceModal p={p} user={user} loc={loc} type={section.fileType} internal onClose={() => setAddingFile(false)} />}
      {removing && (
        <Modal title="Remove this note?" onClose={() => setRemoving(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { removeNote(p.id, removing.id); setRemoving(null) }}>Remove</button>
        </>}>
          <p>“{removing.title}” is removed. Attached files stay in Assets.</p>
        </Modal>
      )}
    </Card>
  )
}

function NoteModal({ p, user, loc, section, note, fileType, onClose }: {
  p: Product; user: User; loc: string; section: InternalSection; note?: InternalNote; fileType?: AssetType; onClose: () => void
}) {
  const product = useStore((s) => s.db.products.find((x) => x.id === p.id)) ?? p
  const scopes = writableScopes(user).filter((s) => loc === GLOBAL || s === GLOBAL || s === loc)
  const [scope, setScope] = useState(note?.scope ?? (scopes.includes(loc) ? loc : scopes[0]))
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [ids, setIds] = useState<string[]>(note?.resourceIds ?? [])
  const [adding, setAdding] = useState(false)
  const options = product.assets.filter((a) => loc === GLOBAL || a.scope === GLOBAL || a.scope === loc)
  return (
    <>
      <Modal title={note ? 'Edit note' : 'Add a note'} wide onClose={onClose} footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!title.trim()} onClick={() => { saveNote(p.id, { id: note?.id, section, scope, title: title.trim(), body: body.trim(), resourceIds: ids }); onClose() }}>Save</button>
      </>}>
        <div className="form-grid">
          <label className="field"><span>Title</span><input id="note-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field"><span>Applies to</span>
            <select id="note-scope" value={scope} onChange={(e) => setScope(e.target.value)} disabled={scopes.length < 2}>
              {scopes.map((s) => <option key={s} value={s}>{s === GLOBAL ? 'Global (every market)' : localeName(s)}</option>)}
            </select>
          </label>
          <label className="field span-2"><span>Note</span><textarea id="note-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        </div>
        <fieldset className="field">
          <legend>Related files and content</legend>
          {options.length === 0 ? <p className="muted small">No files added to this product yet.</p> : (
            <div className="checks checks-grid">
              {options.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={ids.includes(a.id)} onChange={(e) => setIds(e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id))} />
                  {a.title}
                </label>
              ))}
            </div>
          )}
          {addableTypes(user).length > 0 && <button className="link-btn small" onClick={() => setAdding(true)}><Paperclip size={14} />Upload or link a new file</button>}
        </fieldset>
      </Modal>
      {adding && <ResourceModal p={p} user={user} loc={loc} type={fileType} internal onClose={() => setAdding(false)} onSaved={(id) => setIds((x) => [...x, id])} />}
    </>
  )
}

/** The range's concept from the Product Brand Guidelines: read only, the same for every product in the range */
function RangeConceptBlock({ range, c }: { range: string; c: RangeConcept }) {
  const rows: [string, string | undefined][] = [
    ['Tagline', c.tagline], ['Key attributes', c.attributes], ['Positioning', c.positioning], ['Differentiation', c.differentiation], ['Concept positioning', c.conceptPositioning],
  ]
  return (
    <article className="inote concept">
      <header className="inote-head">
        <span className="scope-tag global">Global</span>
        <h3>{range} concept</h3>
        <GlobalLock label={`${GUIDELINES}, page ${c.page}`} />
      </header>
      {c.description ? <CopyValue value={c.description} /> : <p className="muted small">The guidelines describe this concept as coming soon.</p>}
      {rows.some(([, v]) => v) && (
        <dl className="concept-facts">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
    </article>
  )
}
