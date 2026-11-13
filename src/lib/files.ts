// Asset previews, product images, copying text and the product sheet PDF.
import type { AssetRef, Copy, Product } from '../types'
import { GLOBAL, LIFECYCLE_LABEL, marketLabel } from '../data/reference'
import { approvedContent } from '../data/rules'
import { BIOMAR_LOGO, logoFor } from './logos'
import { saveFile } from './save'

/* ---------- Bundled previews (src/assets/logos, src/assets/bags) ---------- */

const bundled = {
  ...import.meta.glob('../assets/bags/*.webp', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../assets/logos/*.png', { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>

export function previewUrl(a: AssetRef): string | null {
  return a.preview ? bundled[`../assets/${a.preview}`] ?? null : null
}

/* ---------- Product images ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cache = new Map<string, string>()

/** Tile with the BioMar mark and the product name, for products without a logo. */
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
export function productImage(p: Product): string {
  const logo = p.assets.find((a) => a.type === 'logo' && a.scope === GLOBAL)
  return (logo && previewUrl(logo)) ?? logoFor(p)?.url ?? nameTile(p)
}

/** The hero image, or the bag design until a hero image is linked */
export function heroImage(p: Product): { url: string; isHero: boolean } | null {
  const hero = p.assets.find((a) => a.type === 'hero' && previewUrl(a))
  if (hero) return { url: previewUrl(hero)!, isHero: true }
  const bag = p.assets.find((a) => a.type === 'bag' && a.scope === GLOBAL && previewUrl(a))
  return bag ? { url: previewUrl(bag)!, isHero: false } : null
}

/* ---------- Download & copy ---------- */

export async function downloadPreview(a: AssetRef) {
  const url = previewUrl(a)
  if (!url) return
  saveFile(await fetch(url).then((r) => r.blob()), a.fileName ?? `${a.title}.${a.preview?.split('.').pop() ?? 'png'}`)
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

export const listAsText = (items: string[]) => items.filter(Boolean).map((b) => `• ${b}`).join('\n')

function facts(p: Product): [string, string][] {
  return [
    ['Range', p.range], ['Species', p.species], ['Production stage', p.stages.join(', ')], ['Category', p.categories.join(', ')],
    ['Product code', p.code], ['Feed type', p.feedType], ['Pellet sizes', p.pelletSizes.join(', ')], ['Packaging', p.packaging.join(', ')],
  ]
}

/** The approved text for a locale as plain text, ready to paste into a document, slide or email. */
export function productAsText(p: Product, loc: string): string {
  const { copy } = approvedContent(p, loc)
  const lines = [`${p.name} – ${p.species}`]
  if (copy.tagline) lines.push(copy.tagline)
  lines.push('')
  if (copy.shortDescription) lines.push(copy.shortDescription, '')
  if (copy.description) lines.push(copy.description, '')
  if (copy.keyBenefits.length) lines.push('Key benefits', listAsText(copy.keyBenefits), '')
  if (copy.sellingPoints.length) lines.push('Selling points', listAsText(copy.sellingPoints), '')
  for (const [k, v] of facts(p)) if (v) lines.push(`${k}: ${v}`)
  return lines.join('\n').trim()
}

/* ---------- Product sheet PDF ---------- */

type Line = { text: string; size: number; bold?: boolean; gap?: number }

function sheetLines(p: Product, loc: string, copy: Copy, note: string): Line[] {
  const out: Line[] = []
  out.push({ text: `${p.name} – ${p.species}`, size: 22, bold: true })
  if (copy.tagline) out.push({ text: copy.tagline, size: 13 })
  out.push({ text: '', size: 8 })
  if (copy.description || copy.shortDescription) out.push({ text: copy.description || copy.shortDescription, size: 10.5 })
  if (copy.keyBenefits.length) {
    out.push({ text: 'Key benefits', size: 13, bold: true, gap: 10 })
    copy.keyBenefits.forEach((b) => out.push({ text: `•  ${b}`, size: 10.5 }))
  }
  if (copy.sellingPoints.length) {
    out.push({ text: 'Selling points', size: 13, bold: true, gap: 10 })
    copy.sellingPoints.forEach((b) => out.push({ text: `•  ${b}`, size: 10.5 }))
  }
  out.push({ text: 'Product details', size: 13, bold: true, gap: 10 })
  for (const [k, v] of facts(p)) if (v) out.push({ text: `${k}: ${v}`, size: 10.5 })
  if (p.lifecycle !== 'active') out.push({ text: `Lifecycle: ${LIFECYCLE_LABEL[p.lifecycle]}`, size: 10.5 })
  out.push({ text: `BioMar Product Information · ${loc === GLOBAL ? 'Global (English)' : marketLabel(loc)} · ${new Date().toLocaleDateString('en-GB')}. ${note}`, size: 8, gap: 16 })
  return out
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50

/** Text PDF with the built-in Helvetica font: selectable text, for languages written in Western European characters. */
function textPdf(lines: Line[]): Uint8Array {
  const winAnsi = (s: string) => s.replace(/[–—]/g, '-').replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/•/g, '\x95').replace(/™/g, '\x99').replace(/€/g, '\x80')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const width = (s: string, size: number) => s.length * size * 0.5
  let y = PAGE_H - 60
  let content = '0.07 0.16 0.30 rg 0 812 595 30 re f\n0 g\nBT\n'
  for (const l of lines) {
    y -= l.gap ?? 0
    const words = l.text.split(/\s+/)
    let row = ''
    const flush = () => { y -= l.size * 1.4; if (y > 40) content += `/${l.bold ? 'F2' : 'F1'} ${l.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(1)} Tm (${winAnsi(row)}) Tj\n`; row = '' }
    if (!l.text) { y -= l.size; continue }
    for (const w of words) {
      if (row && width(`${row} ${w}`, l.size) > PAGE_W - MARGIN * 2) flush()
      row = row ? `${row} ${w}` : w
    }
    flush()
  }
  content += 'ET\n'
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ]
  return assemble(objs.map((o) => latin1(o)))
}

/** Image PDF drawn by the browser, for languages Helvetica cannot show (Greek, Turkish, Polish, Vietnamese, Chinese). */
async function imagePdf(lines: Line[]): Promise<Uint8Array> {
  const scale = 2.5
  const c = document.createElement('canvas')
  c.width = PAGE_W * scale
  c.height = PAGE_H * scale
  const g = c.getContext('2d')!
  g.scale(scale, scale)
  g.fillStyle = '#fff'; g.fillRect(0, 0, PAGE_W, PAGE_H)
  g.fillStyle = '#13284c'; g.fillRect(0, 0, PAGE_W, 30)
  g.fillStyle = '#17223a'
  let y = 60
  for (const l of lines) {
    y += l.gap ?? 0
    if (!l.text) { y += l.size; continue }
    g.font = `${l.bold ? 700 : 400} ${l.size}px Montserrat, Arial, "Noto Sans", "Microsoft YaHei", sans-serif`
    const cjk = /[　-鿿]/.test(l.text)
    const tokens = cjk ? [...l.text] : l.text.split(/\s+/)
    let row = ''
    const flush = () => { y += l.size * 1.4; if (y < PAGE_H - 30) g.fillText(row, MARGIN, y); row = '' }
    for (const t of tokens) {
      const test = row ? (cjk ? row + t : `${row} ${t}`) : t
      if (row && g.measureText(test).width > PAGE_W - MARGIN * 2) { flush(); row = t } else row = test
    }
    flush()
  }
  const jpeg = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
  const img = new Uint8Array(await jpeg.arrayBuffer())
  const content = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im1 Do Q`
  const objs: Uint8Array[] = [
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`),
    concat([latin1(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`), img, latin1('\nendstream')]),
    latin1(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
  ]
  return assemble(objs)
}

function latin1(s: string): Uint8Array {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return b
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
function assemble(objs: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [latin1('%PDF-1.4\n')]
  let len = parts[0].length
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(len)
    const chunk = concat([latin1(`${i + 1} 0 obj\n`), o, latin1('\nendobj\n')])
    parts.push(chunk)
    len += chunk.length
  })
  parts.push(latin1(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF`))
  return concat(parts)
}

/** One-page product sheet with the latest approved information for a locale. */
export async function downloadProductSheet(p: Product, loc: string) {
  const { copy, fallback, current } = approvedContent(p, loc)
  const note = fallback ? 'No approved local copy yet: global English text shown.' : current ? 'Approved content.' : 'Latest approved version; a newer version is being prepared.'
  const lines = sheetLines(p, loc, copy, note)
  const western = lines.every((l) => /^[\x20-\x7e\xa0-\xff–—“”„‘’…•™€]*$/.test(l.text))
  const bytes = western ? textPdf(lines) : await imagePdf(lines)
  const suffix = loc === GLOBAL ? 'global' : loc.toLowerCase()
  await saveFile(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${p.id}-${suffix}-product-sheet.pdf`)
}
