// Sample artwork for the prototype. Real assets would be uploaded files;
// these SVGs stand in for the imported sample assets so every product has something to preview.
import type { Asset, Product } from '../types'
import { RANGE_COLORS } from '../data/reference'

function rng(seedStr: string) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

export function rangeColor(range: string) {
  return RANGE_COLORS[range] ?? '#1b3a6b'
}

function fish(x: number, y: number, s: number, flip: boolean, fill: string, op: number) {
  const d = `M0,0 C14,-9 34,-10 48,-2 L60,-10 L58,0 L60,10 L48,2 C34,10 14,9 0,0 Z`
  return `<path d="${d}" transform="translate(${x},${y}) scale(${flip ? -s : s},${s})" fill="${fill}" opacity="${op}"/>`
}

/** Underwater hero image with fish and pellets */
export function heroSvg(p: Product, w = 1200, h = 750): string {
  const r = rng(p.id + 'hero')
  const c = rangeColor(p.range)
  const hue = 178 + r() * 40
  const light = r() > 0.5
  let fishes = ''
  const nFish = 8 + Math.floor(r() * 24)
  for (let i = 0; i < nFish; i++) {
    const s = 0.8 + r() * 2.4
    fishes += fish(r() * w, 80 + r() * (h - 260), s, r() > 0.5, '#e8f3f7', 0.25 + r() * 0.5)
  }
  let pellets = ''
  for (let i = 0; i < 70; i++) {
    const px = r() * w, py = h - 160 + r() * 200, pr = 6 + r() * 9
    pellets += `<ellipse cx="${px}" cy="${py}" rx="${pr}" ry="${pr * 0.85}" fill="hsl(${28 + r() * 10},${45 + r() * 20}%,${30 + r() * 18}%)"/>`
  }
  let bubbles = ''
  for (let i = 0; i < 18; i++) bubbles += `<circle cx="${r() * w}" cy="${r() * h * 0.7}" r="${2 + r() * 5}" fill="none" stroke="#fff" stroke-opacity=".35"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},${light ? 60 : 50}%,${light ? 48 : 38}%)"/><stop offset=".55" stop-color="hsl(${hue + 8},70%,${light ? 26 : 20}%)"/><stop offset="1" stop-color="hsl(${hue + 12},75%,10%)"/></linearGradient>
<radialGradient id="l" cx=".3" cy="0" r=".8"><stop offset="0" stop-color="#bff3ff" stop-opacity=".55"/><stop offset="1" stop-color="#bff3ff" stop-opacity="0"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#l)"/>
${bubbles}${fishes}${pellets}
<rect x="0" y="${h - 10}" width="${w}" height="10" fill="${c}"/>
</svg>`
}

/** Close-up of pellets */
export function highresSvg(p: Product, w = 1200, h = 800): string {
  const r = rng(p.id + 'hr')
  let s = ''
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * h, rad = 22 + r() * 18
    const l = 28 + r() * 20
    s += `<g><circle cx="${x}" cy="${y}" r="${rad}" fill="hsl(${26 + r() * 10},${45 + r() * 15}%,${l}%)"/><circle cx="${x - rad * 0.3}" cy="${y - rad * 0.3}" r="${rad * 0.35}" fill="#fff" opacity=".12"/></g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#3b2617"/>${s}</svg>`
}

/** Feed bag packshot */
export function bagSvg(p: Product, w = 800, h = 1000): string {
  const c = rangeColor(p.range)
  const kg = p.packaging[0]?.match(/\d+\s?kg/)?.[0] ?? '25 kg'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="#eef1f5"/>
<ellipse cx="${w / 2}" cy="${h - 60}" rx="280" ry="26" fill="#000" opacity=".12"/>
<path d="M190,120 Q400,90 610,120 L640,900 Q400,935 160,900 Z" fill="#fff" stroke="#d5dbe3" stroke-width="3"/>
<path d="M190,120 Q400,90 610,120 L614,190 Q400,165 186,190 Z" fill="#0f2147"/>
<path d="M170,620 Q400,600 632,620 L640,900 Q400,935 160,900 Z" fill="${c}"/>
<text x="400" y="160" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-size="34" font-weight="700" font-style="italic" fill="#fff">BioMar</text>
<text x="400" y="380" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-size="${p.name.length > 14 ? 50 : 70}" font-weight="700" fill="#0f2147">${esc(p.name)}</text>
<text x="400" y="440" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-size="34" fill="#44546a">${esc(p.species)}</text>
<text x="400" y="720" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-size="30" font-weight="600" fill="#fff">${esc(p.range.toUpperCase())}</text>
<text x="400" y="830" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-size="56" font-weight="700" fill="#fff">${esc(kg)}</text>
</svg>`
}

/** Cover thumbnail for documents (datasheets, brochures) */
export function docSvg(p: Product, a: Asset, w = 600, h = 800): string {
  const c = rangeColor(p.range)
  const title = a.type === 'brochure' ? `${p.range} brochure` : 'Technical datasheet'
  let lines = ''
  for (let i = 0; i < 12; i++) lines += `<rect x="60" y="${420 + i * 26}" width="${300 + ((i * 97) % 180)}" height="9" rx="4" fill="#d6dce5"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="#fff"/><rect width="${w}" height="${a.type === 'brochure' ? 360 : 150}" fill="${a.type === 'brochure' ? c : '#0f2147'}"/>
<text x="60" y="95" font-family="Montserrat,Arial,sans-serif" font-size="34" font-weight="700" font-style="italic" fill="#fff">BioMar</text>
<text x="60" y="${a.type === 'brochure' ? 300 : 230}" font-family="Montserrat,Arial,sans-serif" font-size="40" font-weight="700" fill="${a.type === 'brochure' ? '#fff' : '#0f2147'}">${esc(p.name)}</text>
<text x="60" y="${a.type === 'brochure' ? 340 : 275}" font-family="Montserrat,Arial,sans-serif" font-size="24" fill="${a.type === 'brochure' ? '#fff' : '#44546a'}">${esc(title)}${a.scope !== 'global' ? ' · ' + esc(a.scope) : ''}</text>
${lines}
<rect x="0" y="${h - 14}" width="${w}" height="14" fill="${c}"/>
<text x="${w - 60}" y="${h - 40}" text-anchor="end" font-family="Montserrat,Arial,sans-serif" font-size="22" font-weight="700" fill="#b4232a">PDF</text>
</svg>`
}

/** URL to show as a thumbnail/preview for an asset. */
export function assetImageUrl(p: Product, a: Asset, blobUrls: Record<string, string>): string | null {
  if (a.source === 'upload') return a.mime.startsWith('image/') ? blobUrls[a.id] ?? null : null
  switch (a.type) {
    case 'hero': return toUrl(heroSvg(p))
    case 'highres': return toUrl(highresSvg(p))
    case 'bag': return toUrl(bagSvg(p))
    default: return toUrl(docSvg(p, a))
  }
}

const cache = new Map<string, string>()
/** Cached hero thumbnail for lists. */
export function productThumb(p: Product, blobUrls: Record<string, string>): string | null {
  const hero = p.assets.find((a) => a.type === 'hero' && a.scope === 'global')
  if (!hero) return null
  if (hero.source === 'upload') return blobUrls[hero.id] ?? null
  const key = p.id + p.range
  if (!cache.has(key)) cache.set(key, toUrl(heroSvg(p, 480, 300)))
  return cache.get(key)!
}

/** Decorative banner art for dashboard cards */
export function bannerSvg(kind: 'pellets' | 'fish'): string {
  const fake = { id: kind, range: 'POWER', name: '', species: '', packaging: [] } as unknown as Product
  return toUrl(kind === 'fish' ? heroSvg(fake, 900, 380) : highresSvg(fake, 900, 380))
}
