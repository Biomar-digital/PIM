import { useRef, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, UploadCloud } from 'lucide-react'
import type { Product, User } from '../types'
import { readImport, type ImportResult } from '../lib/excel'
import { displayValue, isEmptyValue } from '../lib/fields'
import { saveGlobalMany, type GlobalPatch } from '../data/store'
import { Modal } from './ui'

/** Import an edited Excel export: read it, show every change, then save on confirmation. */
export function ImportModal({ products, users, onClose }: { products: Product[]; users: User[]; onClose: () => void }) {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const read = async (file?: File) => {
    if (!file) return
    setBusy(true); setError(''); setFileName(file.name)
    try { setResult(await readImport(file, products, users)) } catch { setError('This file could not be read. Use an .xlsx file exported from Product Information.') }
    setBusy(false)
  }
  const apply = () => {
    if (!result) return
    const byProduct = new Map<string, GlobalPatch>()
    for (const c of result.changes) byProduct.set(c.product.id, { ...byProduct.get(c.product.id), [c.field.key]: c.after } as GlobalPatch)
    saveGlobalMany([...byProduct].map(([id, patch]) => ({ id, patch })), ' (Excel import)')
    onClose()
  }
  const productsChanged = result ? new Set(result.changes.map((c) => c.product.id)).size : 0
  const show = (c: ImportResult['changes'][number], v: string | string[]) => {
    const t = displayValue(c.field, v, users)
    return t ? (t.length > 140 ? t.slice(0, 140) + '…' : t) : <span className="cell-empty">Empty</span>
  }

  return (
    <Modal title="Import from Excel" onClose={onClose} wide footer={<>
      {result && <span className="muted small grow">{productsChanged} {productsChanged === 1 ? 'product' : 'products'} will change. They become drafts that need approval.</span>}
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!result || !result.changes.length} onClick={apply}>Save {result?.changes.length ?? ''} {result?.changes.length === 1 ? 'change' : 'changes'}</button>
    </>}>
      {!result ? (
        <>
          <p className="muted">Start from <strong>Export to Excel</strong>, edit the Products sheet and import it here. You will see every change before anything is saved.</p>
          <div className="drop" onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); read(e.dataTransfer.files[0]) }}>
            <UploadCloud size={32} />
            <strong>{busy ? 'Reading the file' : 'Drop the Excel file here or click to choose'}</strong>
            <span className="muted small">.xlsx files</span>
            <input id="import-file" ref={input} type="file" hidden accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => read(e.target.files?.[0])} />
          </div>
          {error && <div className="note note-warn"><AlertTriangle size={16} />{error}</div>}
        </>
      ) : (
        <>
          <p className="row-gap wrap"><FileSpreadsheet size={18} /><strong>{fileName}</strong><span className="muted small">{result.rows} rows read from “{result.sheetName}”, {result.columns.length} columns recognised</span></p>
          {result.problems.length > 0 && (
            <div className="note note-warn">
              <AlertTriangle size={16} />
              <div>
                <strong>{result.problems.length} {result.problems.length === 1 ? 'thing' : 'things'} will be skipped:</strong>
                <ul className="bullets small">{result.problems.slice(0, 8).map((m) => <li key={m}>{m}</li>)}</ul>
                {result.problems.length > 8 && <span className="small">And {result.problems.length - 8} more.</span>}
              </div>
            </div>
          )}
          {result.changes.length === 0 ? (
            <p className="muted">No differences found. The file matches what is already in Product Information.</p>
          ) : (
            <div className="table-wrap import-preview">
              <table className="table">
                <thead><tr><th>Product</th><th>Field</th><th>Now</th><th>After import</th></tr></thead>
                <tbody>
                  {result.changes.map((c, i) => (
                    <tr key={i}>
                      <td className="nowrap small"><strong>{c.product.name}</strong> – {c.product.species}</td>
                      <td className="small nowrap">{c.field.label}</td>
                      <td className="small">{isEmptyValue(c.before) ? <span className="cell-empty">Empty</span> : <del className="d-del">{show(c, c.before)}</del>}</td>
                      <td className="small">{isEmptyValue(c.after) ? <span className="cell-empty">Empty</span> : <ins className="d-add">{show(c, c.after)}</ins>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button className="link-btn" onClick={() => setResult(null)}>Choose another file</button>
        </>
      )}
    </Modal>
  )
}
