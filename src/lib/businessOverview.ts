export type InsightMarket = 'BR' | 'US'
export type InsightPeriod = '7d' | '30d' | '90d'

const PERIOD_SCALE: Record<InsightPeriod, number> = { '7d': 0.25, '30d': 1, '90d': 2.9 }

const PERIOD_LABEL: Record<InsightPeriod, string> = {
  '7d': 'últimos 7 dias',
  '30d': 'últimos 30 dias',
  '90d': 'últimos 90 dias',
}

type RawMarket = {
  marketName: string
  currency: string
  today: { late: number; declined: number; noLabel: number }
  mrr: number
  ticket: number
  active: number
  canceling: number
  pastDue: number
  renewing: number
  canceled: number
  deltas: [string, string, string, string]
  checkouts: number
  linked: number
  stripe: number
  simplified: number
  newW: number[]
  canW: number[]
  flavors: Array<[string, number]>
  packs: Array<[string, number, number]>
}

const RAW: Record<InsightMarket, RawMarket> = {
  BR: {
    marketName: 'Brasil',
    currency: 'R$',
    today: { late: 3, declined: 2, noLabel: 5 },
    mrr: 241390,
    ticket: 188,
    active: 1284,
    canceling: 46,
    pastDue: 19,
    renewing: 312,
    canceled: 58,
    deltas: ['+6,8%', '+5,1%', '+1,9%', '−0,4 p.p.'],
    checkouts: 2140,
    linked: 1702,
    stripe: 1391,
    simplified: 0.38,
    newW: [72, 81, 68, 90, 95, 88, 102, 97],
    canW: [14, 12, 17, 11, 15, 13, 12, 10],
    flavors: [
      ['Frango ao curry', 1840],
      ['Salmão teriyaki', 1415],
      ['Carne com chimichurri', 1172],
      ['Grão-de-bico e tahine', 896],
      ['Tofu oriental', 611],
    ],
    packs: [
      ['5 refeições / semana', 486, 159],
      ['10 refeições / semana', 571, 198],
      ['14 refeições / semana', 227, 239],
    ],
  },
  US: {
    marketName: 'EUA',
    currency: 'US$',
    today: { late: 1, declined: 1, noLabel: 4 },
    mrr: 61380,
    ticket: 149,
    active: 412,
    canceling: 18,
    pastDue: 7,
    renewing: 104,
    canceled: 21,
    deltas: ['+9,3%', '+8,4%', '+0,8%', '+0,3 p.p.'],
    checkouts: 690,
    linked: 541,
    stripe: 438,
    simplified: 0.44,
    newW: [21, 24, 19, 27, 30, 26, 31, 29],
    canW: [5, 4, 6, 4, 5, 4, 3, 4],
    flavors: [
      ['Chicken curry', 602],
      ['Salmon teriyaki', 517],
      ['Steak chimichurri', 344],
      ['Chickpea tahini', 281],
      ['Sesame tofu', 196],
    ],
    packs: [
      ['5 meals / week', 158, 124],
      ['10 meals / week', 186, 155],
      ['14 meals / week', 68, 189],
    ],
  },
}

function formatInt(value: number) {
  return Math.round(value).toLocaleString('pt-BR')
}

function formatMoney(currency: string, value: number) {
  return `${currency} ${formatInt(value)}`
}

function formatPct(value: number) {
  return `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function buildBusinessOverview(market: InsightMarket, period: InsightPeriod) {
  const raw = RAW[market]
  const scale = PERIOD_SCALE[period]
  const canceled = Math.round(raw.canceled * scale)
  const churn = canceled / (raw.active + canceled)
  const checkouts = Math.round(raw.checkouts * scale)
  const linked = Math.round(raw.linked * scale)
  const stripe = Math.round(raw.stripe * scale)
  const billing = raw.mrr * 1.11 * scale

  const revenue = [
    { label: 'MRR', value: formatMoney(raw.currency, raw.mrr), delta: raw.deltas[0], good: true },
    { label: 'Faturamento no período', value: formatMoney(raw.currency, billing), delta: raw.deltas[1], good: true },
    { label: 'Ticket médio', value: formatMoney(raw.currency, raw.ticket), delta: raw.deltas[2], good: true },
    { label: 'Churn no período', value: formatPct(churn), delta: raw.deltas[3], good: !raw.deltas[3].startsWith('+') },
  ]

  const subscriptions = [
    { label: 'Ativas', value: formatInt(raw.active), hint: 'Cobrança em dia', dot: 'success' as const },
    { label: 'Cancelando', value: formatInt(raw.canceling), hint: 'Encerram no fim do ciclo', dot: 'warning' as const },
    { label: 'Em atraso', value: formatInt(raw.pastDue), hint: 'Pagamento pendente', dot: 'danger' as const },
    { label: 'Renovam em 7 dias', value: formatInt(raw.renewing), hint: 'Próximas cobranças', dot: 'neutral' as const },
    { label: 'Canceladas', value: formatInt(canceled), hint: 'No período selecionado', dot: 'muted' as const },
  ]

  const axisMax = Math.ceil(Math.max(...raw.newW) / 20) * 20
  const weeks = raw.newW.map((created, index) => {
    const cancelled = raw.canW[index]
    const week = 36 + index
    return {
      label: `S${week}`,
      newHeight: Math.round((created / axisMax) * 100),
      cancelHeight: Math.round((cancelled / axisMax) * 100),
      tip: `Semana ${week}: ${created} novas, ${cancelled} cancelamentos`,
    }
  })
  const totalNew = raw.newW.reduce((sum, value) => sum + value, 0)
  const totalCancelled = raw.canW.reduce((sum, value) => sum + value, 0)

  const funnel = [
    { label: 'Checkouts iniciados', value: formatInt(checkouts), width: 100 },
    { label: 'Vinculados ao Stripe', value: formatInt(linked), width: Math.round((linked / checkouts) * 100), conversion: formatPct(raw.linked / raw.checkouts) },
    { label: 'Assinaturas ativas', value: formatInt(stripe), width: Math.round((stripe / checkouts) * 100), conversion: formatPct(raw.stripe / raw.linked) },
  ]

  const flavorMax = raw.flavors[0][1]
  const mixTotal = raw.flavors.reduce((sum, flavor) => sum + flavor[1], 0)
  const flavors = raw.flavors.map(([name, qty]) => ({
    name,
    qty: formatInt(qty),
    width: Math.round((qty / flavorMax) * 100),
  }))
  const packTotal = raw.packs.reduce((sum, pack) => sum + pack[1], 0)
  const packs = raw.packs.map(([name, subs, ticket]) => ({
    name,
    subs: formatInt(subs),
    share: formatPct(subs / packTotal),
    ticket: formatMoney(raw.currency, ticket),
  }))

  return {
    marketName: raw.marketName,
    periodLabel: PERIOD_LABEL[period],
    today: raw.today,
    revenue,
    subscriptions,
    weeks,
    axisMax,
    axisMid: axisMax / 2,
    trendAria: `Gráfico de barras: ${formatInt(totalNew)} novas assinaturas e ${formatInt(totalCancelled)} cancelamentos nas últimas 8 semanas`,
    totalNew: formatInt(totalNew),
    totalCancelled: formatInt(totalCancelled),
    net: `+${formatInt(totalNew - totalCancelled)}`,
    funnel,
    conversionTotal: formatPct(raw.stripe / raw.checkouts),
    simplified: formatPct(raw.simplified),
    flavors,
    mixTotal: formatInt(mixTotal),
    packs,
    mrrValue: raw.mrr,
  }
}
