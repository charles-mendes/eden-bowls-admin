import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { useAuth } from '../contexts/AuthContext'
import { buildBusinessOverview, type InsightMarket, type InsightPeriod } from '../lib/businessOverview'
import { demoInsightsEnabled } from '../lib/demoInsights'
import { hasBothMarkets, sessionMarkets } from '../lib/markets'

const PERIODS: Array<{ id: InsightPeriod; label: string }> = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
]

function PhaseBadge({ show }: { show: boolean }) {
  if (!show) return null
  return <span className="badge-info">Fase 2</span>
}

export function InsightsRoute() {
  if (!demoInsightsEnabled()) return <Navigate to="/dashboard" replace />
  return <BusinessOverviewPage />
}

export function BusinessOverviewPage() {
  const { user, isReady } = useAuth()
  const [params] = useSearchParams()
  const markets = sessionMarkets(user)
  const both = hasBothMarkets(user)
  const [picked, setPicked] = useState<InsightMarket>('BR')
  const [period, setPeriod] = useState<InsightPeriod>('30d')
  const market: InsightMarket = markets.includes(picked) ? picked : (markets[0] ?? 'BR')
  const showPhase = demoInsightsEnabled() && params.get('fase2') === '1'
  const data = buildBusinessOverview(market, period)

  return (
    <PageFrame
      title="Visão do negócio"
      description={isReady ? `Assinaturas, aquisição e receita de ${data.marketName} nos ${data.periodLabel}.` : 'Carregando sessão.'}
      actions={(
        <div className="day-toolbar">
          <span className="badge-warning">Dados de demonstração</span>
          {both ? (
            <div className="segmented" role="group" aria-label="Mercado">
              {(['BR', 'US'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={market === value} className={market === value ? 'active' : ''} onClick={() => setPicked(value)}>
                  {value === 'BR' ? 'Brasil' : 'EUA'}
                </button>
              ))}
            </div>
          ) : null}
          <div className="segmented" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <button key={item.id} type="button" aria-pressed={period === item.id} className={period === item.id ? 'active' : ''} onClick={() => setPeriod(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    >
      <Link to="/dashboard" className="insights-strip">
        <span className="insights-strip-label">Hoje na operação</span>
        <span><i className="insights-dot insights-dot-danger" aria-hidden="true" />{data.today.late} atrasados</span>
        <span><i className="insights-dot insights-dot-danger" aria-hidden="true" />{data.today.declined} pagamentos recusados</span>
        <span><i className="insights-dot insights-dot-warning" aria-hidden="true" />{data.today.noLabel} sem etiqueta UPS</span>
        <span className="insights-strip-link">Abrir Hoje →</span>
      </Link>

      <section className="day-section" aria-labelledby="insights-revenue">
        <div className="insights-heading">
          <h3 id="insights-revenue">Receita</h3>
          <PhaseBadge show={showPhase} />
        </div>
        <div className="insights-metrics">
          {data.revenue.map((card) => (
            <div key={card.label} className="day-card">
              <span className="day-card-label">{card.label}</span>
              <strong className="insights-value">{card.value}</strong>
              <span className={card.good ? 'insights-delta-good' : 'insights-delta-bad'}>
                {card.delta} <span className="muted">vs. período anterior</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="day-section" aria-labelledby="insights-subs">
        <div className="day-section-head">
          <h3 id="insights-subs">Assinaturas</h3>
          <Link to="/billing">Ver assinantes →</Link>
        </div>
        <div className="insights-metrics insights-metrics-five">
          {data.subscriptions.map((card) => (
            <div key={card.label} className="day-card">
              <span className="day-card-label"><i className={`insights-dot insights-dot-${card.dot}`} aria-hidden="true" />{card.label}</span>
              <strong className="insights-value">{card.value}</strong>
              <span className="day-card-hint">{card.hint}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="insights-split">
        <section className="insights-panel" aria-labelledby="insights-trend">
          <div className="insights-heading">
            <div>
              <h3 id="insights-trend">Tendência semanal</h3>
              <p className="muted">Novas assinaturas e cancelamentos, últimas 8 semanas</p>
            </div>
            <PhaseBadge show={showPhase} />
          </div>
          <div className="insights-legend">
            <span><i className="insights-swatch insights-swatch-new" aria-hidden="true" />Novas</span>
            <span><i className="insights-swatch insights-swatch-cancel" aria-hidden="true" />Cancelamentos</span>
          </div>
          <div role="img" aria-label={data.trendAria} className="insights-chart">
            <div className="insights-axis" aria-hidden="true">
              <span>{data.axisMax}</span>
              <span>{data.axisMid}</span>
              <span>0</span>
            </div>
            <div className="insights-plot">
              {data.weeks.map((week) => (
                <div key={week.label} className="insights-week" title={week.tip}>
                  <div className="insights-week-bars">
                    <span className="insights-col insights-col-new" style={{ height: `${week.newHeight}%` }} />
                    <span className="insights-col insights-col-cancel" style={{ height: `${week.cancelHeight}%` }} />
                  </div>
                  <span className="insights-week-label" aria-hidden="true">{week.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="insights-totals">
            <span>Novas no período <strong>{data.totalNew}</strong></span>
            <span>Cancelamentos <strong>{data.totalCancelled}</strong></span>
            <span>Saldo líquido <strong className="insights-delta-good">{data.net}</strong></span>
          </div>
        </section>

        <section className="insights-panel" aria-labelledby="insights-funnel">
          <div className="day-section-head">
            <div>
              <h3 id="insights-funnel">Funil de aquisição</h3>
              <p className="muted">Do checkout à assinatura ativa no Stripe</p>
            </div>
            <Link to="/onboarding/sessions">Ver checkouts →</Link>
          </div>
          <div className="insights-funnel">
            {data.funnel.map((stage) => (
              <div key={stage.label}>
                {stage.conversion ? <p className="insights-conv">{stage.conversion} converteram</p> : null}
                <div className="insights-funnel-row">
                  <span>{stage.label}</span>
                  <strong>{stage.value}</strong>
                </div>
                <div className="insights-track">
                  <span className="insights-track-fill" style={{ width: `${stage.width}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="insights-totals">
            <span>Conversão total <strong>{data.conversionTotal}</strong></span>
            <span>Checkout simplificado <strong>{data.simplified}</strong></span>
          </div>
        </section>
      </div>

      <section className="insights-panel" aria-labelledby="insights-mix">
        <div className="insights-heading">
          <div>
            <h3 id="insights-mix">Mix das próximas entregas</h3>
            <p className="muted">Porções programadas para os próximos 7 dias, para planejar compras da cozinha</p>
          </div>
          <PhaseBadge show={showPhase} />
        </div>
        <p className="muted">Total: <strong>{data.mixTotal} porções</strong></p>
        <div className="insights-split">
          <div>
            <p className="insights-kicker">Sabores</p>
            {data.flavors.map((flavor) => (
              <div key={flavor.name} className="insights-hbar">
                <span>{flavor.name}</span>
                <span className="insights-track"><span className="insights-track-fill" style={{ width: `${flavor.width}%` }} /></span>
                <strong>{flavor.qty}</strong>
              </div>
            ))}
          </div>
          <div>
            <p className="insights-kicker">Pacotes</p>
            <table className="insights-table">
              <thead>
                <tr>
                  <th scope="col">Pacote</th>
                  <th scope="col">Assinantes</th>
                  <th scope="col">Participação</th>
                  <th scope="col">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {data.packs.map((pack) => (
                  <tr key={pack.name}>
                    <td>{pack.name}</td>
                    <td>{pack.subs}</td>
                    <td>{pack.share}</td>
                    <td>{pack.ticket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="muted">Churn calculado como canceladas no período ÷ (ativas + canceladas). Valores ilustrativos para demonstração.</p>
    </PageFrame>
  )
}
