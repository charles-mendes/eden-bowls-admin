import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ReportColumn<T> = { key: string; label: string; cell: (row: T) => ReactNode; to?: (row: T) => string | null; align?: 'left' }

// Numbers right-aligned in tabular figures; the first column is the item name.
// A column with `to` links each of its cells to the details of that figure.
export function ReportTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  footer,
  empty = 'Nada no período.',
}: {
  caption: string
  columns: ReportColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  footer?: ReactNode[]
  empty?: string
}) {
  if (!rows.length) return <p className="muted">{empty}</p>

  return (
    <div className="table-scroll">
      <table className="insights-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col" className={column.align === 'left' ? 'report-cell-left' : undefined}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => {
                const target = column.to ? column.to(row) : null
                return (
                  <td key={column.key} className={column.align === 'left' ? 'report-cell-left' : undefined}>
                    {target ? <Link to={target} className="table-link">{column.cell(row)}</Link> : column.cell(row)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="report-total">
              {footer.map((cell, index) => <td key={index}>{cell}</td>)}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}
