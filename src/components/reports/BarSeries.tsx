import { Link } from 'react-router-dom'
import { bucketLabel, type Bucket, type Granularity } from '../../lib/reports'

export type SeriesKey = { key: string; label: string; compare?: boolean }

// CSS bars like the overview: accent for the main series, gray for the comparison, partial buckets lighter.
// With `linkFor` every bar is a link to the details of that measure in that bucket.
export function BarSeries({
  title,
  series,
  keys,
  granularity,
  format,
  linkFor,
}: {
  title: string
  series: Bucket[]
  keys: SeriesKey[]
  granularity: Granularity
  format: (value: number) => string
  linkFor?: (bucket: Bucket, key: string) => string
}) {
  const values = (bucket: Bucket, key: string) => Number(bucket[key] ?? 0)
  const max = Math.max(1, ...series.flatMap((bucket) => keys.map((item) => values(bucket, item.key))))
  const totals = keys.map((item) => `${item.label} ${format(series.reduce((sum, bucket) => sum + values(bucket, item.key), 0))}`)

  return (
    <div className="report-series">
      {keys.length > 1 ? (
        <div className="insights-legend">
          {keys.map((item) => (
            <span key={item.key}>
              <i className={item.compare ? 'insights-swatch insights-swatch-cancel' : 'insights-swatch'} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      <div role={linkFor ? 'group' : 'img'} aria-label={`${title}: ${totals.join(', ')}`} className="insights-chart report-chart">
        <div className="insights-axis" aria-hidden="true">
          <span>{format(max)}</span>
          <span>0</span>
        </div>
        <div className="insights-plot report-plot">
          {series.map((bucket) => {
            const tip = [
              bucket.from === bucket.to ? bucket.from : `${bucket.from} a ${bucket.to}`,
              ...keys.map((item) => `${item.label}: ${format(values(bucket, item.key))}`),
              ...(bucket.partial ? ['período parcial'] : []),
            ].join(' · ')
            return (
              <div key={bucket.key} className={bucket.partial ? 'insights-week report-partial' : 'insights-week'} title={tip} data-partial={bucket.partial || undefined}>
                <div className="insights-week-bars">
                  {keys.map((item) => {
                    const className = item.compare ? 'insights-col insights-col-cancel' : 'insights-col'
                    const style = { height: `${(values(bucket, item.key) / max) * 100}%` }
                    if (!linkFor) return <span key={item.key} className={className} style={style} />
                    return (
                      <Link
                        key={item.key}
                        to={linkFor(bucket, item.key)}
                        className={`${className} report-bar-link`}
                        style={style}
                        aria-label={`${item.label} ${bucketLabel(bucket, granularity)}: ${format(values(bucket, item.key))}`}
                      />
                    )
                  })}
                </div>
                <span className="insights-week-label" aria-hidden="true">{bucketLabel(bucket, granularity)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
