// Files: bundled assets (logos, packshots), uploads, thumbnails, downloads, copy and the product sheet PDF.
import type { Asset, Product } from '../types'
import { LIFECYCLE_LABEL } from '../data/reference'
import { BIOMAR_LOGO, logoFor } from './logos'

/* ---------- Bundled files (src/assets/logos, src/assets/bags) ---------- */

const bundled = {
  ...import.meta.glob('../assets/bags/*.webp', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../assets/logos/*.png', { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>

export function assetUrl(a: Asset, blobUrls: Record<string, string>): string | null {
  if (a.source === 'upload') return blobUrls[a.id] ?? null
  return a.file ? bundled[`../assets/${a.file}`] ?? null : null
}

export const isImage = (a: Asset) => a.mime.startsWith('image/')

/* ---------- Product thumbnail ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cache = new Map<string, string>()

/** Square tile with the BioMar mark and the product name, for products without a logo. */
function nameTile(p: Product): string {
  const key = `${p.name}`
  if (!cache.has(key)) {
    const size = Math.min(64, Math.floor(620 / Math.max(1, p.name.length)))
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270"><rect width="480" height="270" fill="#ffffff"/>${
      BIOMAR_LOGO ? `<image href="${BIOMAR_LOGO.url}" x="205" y="30" width="70" height="70"/>` : ''
    }<text x="240" y="${150 + size * 0.6}" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-size="${size}" font-weight="700" fill="#1d3463">${esc(p.name.toUpperCase())}</text></svg>`
    cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  }
  return cache.get(key)!
}

/** The image that identifies a product in lists: its logo, or a name tile. */
export function productImage(p: Product, blobUrls: Record<string, string>): string {
  const logo = p.assets.find((a) => a.type === 'logo' && a.scope === 'global' && isImage(a))
  const url = logo && assetUrl(logo, blobUrls)
  return url ?? logoFor(p)?.url ?? nameTile(p)
}

/** Packshot for the product page header. */
export function productPackshot(p: Product, blobUrls: Record<string, string>): string | null {
  const bag = p.assets.find((a) => a.type === 'bag' && a.scope === 'global' && isImage(a))
  return bag ? assetUrl(bag, blobUrls) : null
}

/* ---------- Download & copy ---------- */

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function downloadAsset(a: Asset, blobUrls: Record<string, string>) {
  const url = assetUrl(a, blobUrls)
  if (!url) return
  save(await fetch(url).then((r) => r.blob()), a.fileName)
}

/** Copy text; falls back to a hidden textarea where the clipboard API is not allowed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.appendChild(t)
    t.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    t.remove()
    return ok
  }
}

/** All global text of a product as plain text, ready to paste into a document or email. */
export function productAsText(p: Product): string {
  const c = p.content
  const lines = [`${p.name} – ${p.species}`]
  if (c.tagline) lines.push(c.tagline)
  lines.push('')
  if (c.shortDescription) lines.push(c.shortDescription, '')
  if (c.description) lines.push(c.description, '')
  if (c.keyBenefits.length) lines.push('Key benefits', ...c.keyBenefits.map((b) => `• ${b}`), '')
  if (c.sellingPoints.length) lines.push('Selling points', ...c.sellingPoints.map((b) => `• ${b}`), '')
  const facts: [string, string][] = [
    ['Range', p.range], ['Category', p.categories.join(', ')], ['Species', p.species], ['Stage', p.stages.join(', ')],
    ['Product code', p.code], ['Feed type', p.feedType], ['Pellet sizes', p.pelletSizes.join(', ')], ['Packaging', p.packaging.join(', ')],
  ]
  for (const [k, v] of facts) if (v) lines.push(`${k}: ${v}`)
  return lines.join('\n').trim()
}

/* ---------- Product sheet PDF (one page, Helvetica, built from the PIM content) ---------- */

const latin = (s: string) =>
  s.replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/®/g, '(R)').replace(/•/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

function wrap(text: string, max: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const w of para.split(' ')) {
      if ((line + ' ' + w).trim().length > max) { out.push(line); line = w } else line = (line + ' ' + w).trim()
    }
    out.push(line)
  }
  return out
}

export function downloadProductSheet(p: Product) {
  const c = p.content
  const rows: [string, number, boolean][] = []
  const add = (t: string, size = 10, bold = false) => rows.push([t, size, bold])
  add(`${p.name} - ${p.species}`, 20, true)
  if (c.tagline) add(c.tagline, 12)
  add('')
  if (c.description) { wrap(c.description, 95).forEach((l) => add(l)); add('') }
  if (c.keyBenefits.length) { add('Key benefits', 12, true); c.keyBenefits.forEach((b) => wrap('- ' + b, 92).forEach((l, i) => add(i ? '  ' + l : l))); add('') }
  add('Product details', 12, true)
  const facts: [string, string][] = [
    ['Range', p.range], ['Category', p.categories.join(', ')], ['Species', p.species], ['Production stage', p.stages.join(', ')],
    ['Product code', p.code], ['Feed type', p.feedType], ['Pellet sizes', p.pelletSizes.join(', ')], ['Packaging', p.packaging.join(', ')],
    ['Lifecycle', LIFECYCLE_LABEL[p.lifecycle]],
  ]
  for (const [k, v] of facts) if (v) add(`${k}:  ${v}`)
  add('')
  add(`BioMar Product Information, ${new Date().toLocaleDateString('en-GB')}. Status: ${p.status.status === 'approved' ? 'approved' : 'not yet approved'}.`, 8)

  let y = 790
  let content = 'BT\n'
  for (const [t, size, bold] of rows) {
    y -= size + 6
    if (y < 40) break
    content += `/${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 50 ${y} Tm (${latin(t)}) Tj\n`
  }
  content += 'ET\n0.07 0.16 0.30 rg 0 812 595 30 re f\n'
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff
  save(new Blob([bytes], { type: 'application/pdf' }), `${p.id}-product-sheet.pdf`)
}
