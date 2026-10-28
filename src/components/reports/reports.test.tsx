import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarSeries } from './BarSeries'
import { FunnelBars } from './FunnelBars'
import { KpiCard } from './KpiCard'
import { ReportTable } from './ReportTable'

describe('report components', () => {
  it('KpiCard shows the change for a period card and "agora" for a point-in-time card', () => {
    const { rerender } = render(<KpiCard label="Canceladas" kpi={{ value: 5, previous: 4 }} market="BR" lowerIsBetter />)
    expect(screen.getByText('+25,0%')).toHaveClass('insights-delta-bad')

    rerender(<KpiCard label="Ativas" kpi={{ value: 40, previous: null }} market="BR" now />)
    expect(screen.getByText('agora')).toBeInTheDocument()
    expect(screen.queryByText(/vs\. período anterior/)).not.toBeInTheDocument()
  })

  it('BarSeries labels the chart with totals and marks partial buckets', () => {
    render(
      <BarSeries
        title="Novas e cancelamentos"
        granularity="week"
        format={(value) => String(value)}
        keys={[{ key: 'newCount', label: 'Novas' }, { key: 'canceled', label: 'Cancelamentos', compare: true }]}
        series={[
          { key: '2026-10-05', from: '2026-10-05', to: '2026-10-11', partial: false, newCount: 3, canceled: 1 },
          { key: '2026-10-12', from: '2026-10-12', to: '2026-10-14', partial: true, newCount: 2, canceled: 0 },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Novas e cancelamentos: Novas 5, Cancelamentos 1' })).toBeInTheDocument()
    expect(document.querySelector('.report-partial')?.getAttribute('title')).toContain('período parcial')
    expect(document.querySelectorAll('.insights-col-cancel')).toHaveLength(2)
  })

  it('FunnelBars lists every stage with its conversion', () => {
    render(<FunnelBars title="Funil" funnel stages={[{ key: 'a', label: 'Iniciados', value: 10 }, { key: 'b', label: 'Ativos', value: 4, conversion: '40,0%' }]} />)
    expect(screen.getByRole('img', { name: 'Funil: Iniciados 10, Ativos 4' })).toBeInTheDocument()
    expect(screen.getByText('40,0% converteram')).toBeInTheDocument()
  })

  it('ReportTable renders rows and a total footer, or the empty message', () => {
    const columns = [{ key: 'name', label: 'Receita', cell: (row: { name: string }) => row.name }]
    const { rerender } = render(<ReportTable caption="Estoque" columns={columns} rows={[{ name: 'frango' }]} rowKey={(row) => row.name} footer={['Total']} />)
    expect(screen.getByRole('table', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.getByText('Total').closest('tr')).toHaveClass('report-total')

    rerender(<ReportTable caption="Estoque" columns={columns} rows={[]} rowKey={(row) => row.name} empty="Nenhum item." />)
    expect(screen.getByText('Nenhum item.')).toBeInTheDocument()
  })
})
