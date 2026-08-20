import type { MetaItem } from '../lib/checkoutSnapshot'

export function MetaGrid({ items }: { items: MetaItem[] }) {
  if (!items.length) return null

  return (
    <dl className="meta-grid">
      {items.map((item) => (
        <div key={item.label} className="meta-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
