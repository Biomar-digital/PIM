import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import type { Product, User } from '../types'
import { FIELDS, FIELD_BY_KEY, GROUP_LABEL, displayValue, getValue, isEmptyValue, type FieldDef, type FieldGroup, type FieldKey } from '../lib/fields'
import { saveGlobal, saveGlobalMany, useStore, type GlobalPatch } from '../data/store'
import { essentialTodos, isReady } from '../data/rules'
import { productImage } from '../lib/files'
import { ReadyBadge, StatusBadge, Thumb } from './ui'
import { FieldInput } from './FieldInput'

const GROUPS: FieldGroup[] = ['classification', 'specification', 'copy', 'management']

function loadGroups(): FieldGroup[] {
  try { return JSON.parse(localStorage.getItem('pim.sheetGroups') || 'null') ?? ['classification', 'specification'] } catch { return ['classification', 'specification'] }
}

/** Spreadsheet of products: one row per product, one column per field. Click a cell to edit; tick rows to change many at once. */
export function Sheet({ products, users, canEdit }: { products: Product[]; users: User[]; canEdit: boolean }) {
  const blobUrls = useStore((s) => s.blobUrls)
  const [groups, setGroups] = useState<FieldGroup[]>(loadGroups)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ id: string; key: FieldKey } | null>(null)
  const columns = useMemo(() => FIELDS.filter((f) => groups.includes(f.group) && f.key !== 'name'), [groups])
  const toggleGroup = (g: FieldGroup) => {
    const next = groups.includes(g) ? groups.filter((x) => x !== g) : GROUPS.filter((x) => x === g || groups.includes(x))
    setGroups(next)
    try { localStorage.setItem('pim.sheetGroups', JSON.stringify(next)) } catch { /* not available */ }
  }
  const visibleIds = products.map((p) => p.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // Drop selections that are no longer visible after filtering
  useEffect(() => { setSelected((s) => new Set([...s].filter((id) => visibleIds.includes(id)))) }, [products]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sheet-wrap">
      <div className="sheet-tools">
        <span className="muted small">Columns:</span>
        {GROUPS.map((g) => (
          <button key={g} className={`toggle-chip${groups.includes(g) ? ' on' : ''}`} onClick={() => toggleGroup(g)} aria-pressed={groups.includes(g)}>
            {groups.includes(g) && <Check size={13} />}{GROUP_LABEL[g]}
          </button>
        ))}
        {canEdit && <span className="muted small sheet-tip">Click a cell to edit it. Tick rows to change several products at once.</span>}
      </div>

      <div className="sheet-scroll card">
        <table className="sheet">
          <thead>
            <tr>
              <th className="sheet-sticky sheet-first">
                {canEdit && <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} />}
                <span>Product</span>
              </th>
              <th className="sheet-status">Status</th>
              {columns.map((f) => <th key={f.key} style={{ minWidth: f.width, maxWidth: f.width }} title={f.hint}>{f.label}</th>)}
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={selected.has(p.id) ? 'sel' : ''}>
                <td className="sheet-sticky sheet-first">
                  {canEdit && <input type="checkbox" aria-label={`Select ${p.name} – ${p.species}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />}
                  <Link to={`/products/${p.id}`} className="sheet-prod">
                    <Thumb url={productImage(p, blobUrls)} size={28} />
                    <span className="clamp-1"><strong>{p.name}</strong> – {p.species}</span>
                  </Link>
                </td>
                <td className="sheet-status">{isReady(p) ? <ReadyBadge small /> : <StatusBadge status={p.status.status} small />}</td>
                {columns.map((f) => (
                  <Cell key={f.key} p={p} f={f} users={users} canEdit={canEdit}
                    editing={editing?.id === p.id && editing.key === f.key}
                    onEdit={() => setEditing({ id: p.id, key: f.key })} onClose={() => setEditing(null)} />
                ))}
                <td className="small nowrap">{essentialTodos(p).length ? <span className="todo-count">{essentialTodos(p).length} missing</span> : <span className="done-count">Complete</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && selected.size > 0 && <BulkBar ids={[...selected]} products={products} users={users} onDone={() => setSelected(new Set())} />}
    </div>
  )
}

function Cell({ p, f, users, canEdit, editing, onEdit, onClose }: { p: Product; f: FieldDef; users: User[]; canEdit: boolean; editing: boolean; onEdit: () => void; onClose: () => void }) {
  const value = getValue(p, f.key)
  const empty = isEmptyValue(value)
  return (
    <td className={`cell${canEdit ? ' editable' : ''}${editing ? ' editing' : ''}`} style={{ minWidth: f.width, maxWidth: f.width }}
      onClick={() => canEdit && !editing && onEdit()} title={canEdit && !editing ? `Edit ${f.label.toLowerCase()}` : undefined}>
      {empty ? <span className="cell-empty">Empty</span> : <span className="cell-text">{displayValue(f, value, users)}</span>}
      {editing && <CellEditor p={p} f={f} users={users} onClose={onClose} />}
    </td>
  )
}

function CellEditor({ p, f, users, onClose }: { p: Product; f: FieldDef; users: User[]; onClose: () => void }) {
  const [v, setV] = useState<string | string[]>(getValue(p, f.key))
  const ref = useRef<HTMLDivElement>(null)
  const save = () => {
    const value = Array.isArray(v) ? v.map((x) => x.trim()).filter(Boolean) : typeof v === 'string' ? v.trim() : v
    saveGlobal(p.id, { [f.key]: value } as GlobalPatch, true)
    onClose()
  }
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])
  return (
    <div className="cell-pop" ref={ref} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'Enter' && (f.kind === 'text' || f.kind === 'select' || e.ctrlKey || e.metaKey)) { e.preventDefault(); save() }
      }}>
      <div className="cell-pop-head"><strong>{f.label}</strong><span className="muted small">{p.name} – {p.species}</span></div>
      <FieldInput f={f} value={v} onChange={setV} users={users} compact autoFocus />
      <div className="cell-pop-foot">
        <span className="muted small">{f.kind === 'text' || f.kind === 'select' ? 'Enter to save' : 'Ctrl+Enter to save'}</span>
        <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} />Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save}><Check size={14} />Save</button>
      </div>
    </div>
  )
}

/** Change one field on all selected products */
function BulkBar({ ids, products, users, onDone }: { ids: string[]; products: Product[]; users: User[]; onDone: () => void }) {
  const editable = FIELDS.filter((f) => f.key !== 'name')
  const [key, setKey] = useState<FieldKey>('packaging')
  const f = FIELD_BY_KEY[key]
  const empty = f.kind === 'list' || f.kind === 'multi' ? [] : f.kind === 'select' ? f.options!(users)[0]?.value ?? '' : ''
  const [value, setValue] = useState<string | string[]>(empty)
  const [mode, setMode] = useState<'replace' | 'add'>('replace')
  const pickField = (k: FieldKey) => {
    const nf = FIELD_BY_KEY[k]
    setKey(k)
    setValue(nf.kind === 'list' || nf.kind === 'multi' ? [] : nf.kind === 'select' ? (nf.key === 'feedType' ? '' : nf.options!(users)[0]?.value ?? '') : '')
    setMode('replace')
  }
  const apply = () => {
    const clean = Array.isArray(value) ? value.map((x) => x.trim()).filter(Boolean) : (value as string).trim()
    const changes = ids.map((id) => {
      const p = products.find((x) => x.id === id)!
      let next: string | string[] = clean
      if (mode === 'add' && Array.isArray(clean)) next = [...new Set([...(getValue(p, key) as string[]), ...clean])]
      return { id, patch: { [key]: next } as GlobalPatch }
    })
    saveGlobalMany(changes, ' (bulk edit)')
    onDone()
  }
  const isList = f.kind === 'list' || f.kind === 'multi'
  return (
    <div className="bulk-bar" role="region" aria-label="Change selected products">
      <strong className="nowrap">{ids.length} selected</strong>
      <label className="bulk-field">Set
        <select id="bulk-field" value={key} onChange={(e) => pickField(e.target.value as FieldKey)}>
          {editable.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </label>
      {isList && (
        <select id="bulk-mode" value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'add')} aria-label="How to change the list">
          <option value="replace">to exactly</option>
          <option value="add">by adding</option>
        </select>
      )}
      {!isList && <span className="muted">to</span>}
      <div className="bulk-value"><FieldInput f={f} value={value} onChange={setValue} users={users} compact /></div>
      <button className="btn btn-primary btn-sm" onClick={apply}>Apply to {ids.length}</button>
      <button className="btn btn-secondary btn-sm" onClick={onDone}>Clear selection</button>
    </div>
  )
}
