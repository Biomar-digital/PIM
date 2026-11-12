// Small, dependency-free status charts. Colours come from the status tokens in styles.css,
// and every chart has a text legend so identity is never colour-only.
export interface Segment { key: string; label: string; value: number }

export function StackedBar({ segments, height = 10, label }: { segments: Segment[]; height?: number; label?: string }) {
  const total = segments.reduce((n, s) => n + s.value, 0)
  return (
    <div className="stack" style={{ height }} role="img" aria-label={label ?? segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
      {total === 0 && <div className="stack-seg seg-empty" style={{ flex: 1 }} />}
      {segments.filter((s) => s.value > 0).map((s) => (
        <div key={s.key} className={`stack-seg seg-${s.key}`} style={{ flex: s.value }} title={`${s.label}: ${s.value}`} />
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { key: string; label: string; value?: number }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.key}><span className={`legend-dot seg-${i.key}`} />{i.label}{i.value !== undefined && <strong>{i.value}</strong>}</li>
      ))}
    </ul>
  )
}
