import { type ReactNode } from 'react'

export type ReportColumn<T> = { key: string; label: string; cell: (row: T) => ReactNode }

// Numbers right-aligned in tabular figures; the first column is the item name.
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
            {columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td key={column.key}>{column.cell(row)}</td>)}
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
