export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week'], [2629800, 'month'], [31557600, 'year']]
  let label = ''
  for (let i = units.length - 1; i >= 0; i--) {
    const [secs, name] = units[i]
    if (diff >= secs) {
      const n = Math.floor(diff / secs)
      label = `${n} ${name}${n > 1 ? 's' : ''} ago`
      break
    }
  }
  return label
}

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}

export function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
}

export function productTitle(p: { name: string; species: string }): string {
  return `${p.name} – ${p.species}`
}
