// Excel export and import of global product content.
// The export is also the template: edit it in Excel and import it again.
import * as XLSX from 'xlsx'
import type { Product, User } from '../types'
import { FIELDS, fromCell, getValue, sameValue, toCell, type FieldDef } from './fields'
import { LOCALE_STATE_LABEL, essentialTodos, localeState } from '../data/rules'
import { STATUS_LABEL, marketLabel } from '../data/reference'
import { saveFile } from './save'

const ID = 'Product ID'
const READ_ONLY = ['Product', 'Status', 'Missing (essential)']

function save(data: ArrayBuffer, name: string) {
  saveFile(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name)
}

export function exportProducts(products: Product[], users: User[], fileName = 'biomar-products.xlsx') {
  const header = [ID, 'Product', ...FIELDS.map((f) => f.label), 'Status', 'Missing (essential)']
  const rows = products.map((p) => [
    p.id,
    `${p.name} – ${p.species}`,
    ...FIELDS.map((f) => toCell(f, getValue(p, f.key), users)),
    STATUS_LABEL[p.status.status],
    essentialTodos(p).map((t) => t.label).join(', '),
  ])
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  sheet['!cols'] = [{ wch: 30 }, { wch: 34 }, ...FIELDS.map((f) => ({ wch: Math.round(f.width / 7) })), { wch: 18 }, { wch: 30 }]
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) }
  sheet['!freeze'] = { xSplit: 2, ySplit: 1 }

  // Local versions, for reference (read only in this version)
  const tHeader = [ID, 'Product', 'Locale', 'Status', 'Short description', 'Description', 'Key benefits', 'Selling points']
  const tRows = products.flatMap((p) => Object.entries(p.variants).map(([loc, v]) => [
    p.id, `${p.name} – ${p.species}`, marketLabel(loc), LOCALE_STATE_LABEL[localeState(p, loc)], v.shortDescription, v.description, v.keyBenefits.join('\n'), v.sellingPoints.join('\n'),
  ]))
  const tSheet = XLSX.utils.aoa_to_sheet([tHeader, ...tRows])
  tSheet['!cols'] = [{ wch: 30 }, { wch: 34 }, { wch: 8 }, { wch: 24 }, { wch: 18 }, { wch: 50 }, { wch: 70 }, { wch: 50 }, { wch: 50 }]

  const help = [
    ['How to use this file'],
    [''],
    ['1. Edit the Products sheet. Each row is one product; do not change the Product ID column.'],
    ['2. Lists (key benefits, pellet sizes, packaging, category, stage) have one item per line in the cell (Alt+Enter in Excel).'],
    ['3. Columns you do not need can be deleted. Empty cells clear the value.'],
    [`4. ${READ_ONLY.join(', ')} are for information and are ignored on import.`],
    ['5. In Product Information, open Products, choose Import from Excel and select the file. You will see every change before it is saved.'],
    ['6. Imported changes become drafts that need approval, like any other edit.'],
    [''],
    ['Allowed values'],
    ...FIELDS.filter((f) => f.options).map((f) => [f.label, f.options!(users).map((o) => o.label).join(', ')]),
  ]
  const hSheet = XLSX.utils.aoa_to_sheet(help)
  hSheet['!cols'] = [{ wch: 22 }, { wch: 120 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Products')
  XLSX.utils.book_append_sheet(wb, tSheet, 'Local versions')
  XLSX.utils.book_append_sheet(wb, hSheet, 'How to use')
  save(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), fileName)
}

export interface ImportChange {
  product: Product
  field: FieldDef
  before: string | string[]
  after: string | string[]
}

export interface ImportResult {
  sheetName: string
  rows: number
  columns: FieldDef[]
  changes: ImportChange[]
  problems: string[]
}

export async function readImport(file: File, products: Product[], users: User[]): Promise<ImportResult> {
  const wb = XLSX.read(await file.arrayBuffer())
  const sheetName = wb.SheetNames.includes('Products') ? 'Products' : wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '', blankrows: false })
  const problems: string[] = []
  const headerIndex = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === ID.toLowerCase()))
  if (headerIndex < 0) return { sheetName, rows: 0, columns: [], changes: [], problems: [`No “${ID}” column found. Start from an export so the products can be matched.`] }
  const header = rows[headerIndex].map((c) => String(c).trim().toLowerCase())
  const idCol = header.indexOf(ID.toLowerCase())
  const columns = FIELDS.map((f) => ({ f, col: header.indexOf(f.label.toLowerCase()) })).filter((x) => x.col >= 0)
  const unknown = header.filter((h) => h && h !== ID.toLowerCase() && !FIELDS.some((f) => f.label.toLowerCase() === h) && !READ_ONLY.some((r) => r.toLowerCase() === h))
  if (unknown.length) problems.push(`Ignored columns: ${unknown.join(', ')}`)

  const byId = new Map(products.map((p) => [p.id, p]))
  const changes: ImportChange[] = []
  const data = rows.slice(headerIndex + 1).filter((r) => String(r[idCol] ?? '').trim())
  data.forEach((r, i) => {
    const rowNo = headerIndex + i + 2
    const p = byId.get(String(r[idCol]).trim())
    if (!p) { problems.push(`Row ${rowNo}: no product with ID “${r[idCol]}”`); return }
    for (const { f, col } of columns) {
      const parsed = fromCell(f, r[col], users)
      if (parsed.error) { problems.push(`Row ${rowNo} (${p.name} – ${p.species}): ${parsed.error}`); continue }
      const before = getValue(p, f.key)
      if (!sameValue(before, parsed.value)) changes.push({ product: p, field: f, before, after: parsed.value! })
    }
  })
  return { sheetName, rows: data.length, columns: columns.map((c) => c.f), changes, problems }
}
