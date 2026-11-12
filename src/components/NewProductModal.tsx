import { useState } from 'react'
import { CATEGORIES, RANGES, SPECIES, STAGES } from '../data/reference'
import { createProduct } from '../data/store'
import { Modal } from './ui'

export function NewProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: '', species: SPECIES[0], range: RANGES[0], categories: [CATEGORIES[0]], stages: ['Grower'] })
  const valid = f.name.trim().length > 1 && f.stages.length > 0
  const submit = () => valid && onCreated(createProduct({ ...f, name: f.name.trim() }))
  return (
    <Modal
      title="New product"
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid} onClick={submit}>Create draft</button>
      </>}
    >
      <p className="muted">Creates the global master record as a draft. You can add marketing content, assets and markets afterwards.</p>
      <div className="form-grid">
        <label className="field span-2">
          <span>Product name</span>
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. POWER Plus" />
        </label>
        <label className="field">
          <span>Species</span>
          <select value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })}>{SPECIES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="field">
          <span>Product range</span>
          <select value={f.range} onChange={(e) => setF({ ...f, range: e.target.value })}>{RANGES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="field">
          <span>Category</span>
          <select value={f.categories[0]} onChange={(e) => setF({ ...f, categories: [e.target.value] })}>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <fieldset className="field">
          <legend>Production stage</legend>
          <div className="checks">
            {STAGES.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={f.stages.includes(s)} onChange={(e) => setF({ ...f, stages: e.target.checked ? [...f.stages, s] : f.stages.filter((x) => x !== s) })} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
