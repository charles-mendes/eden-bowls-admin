import { Link } from 'react-router-dom'
import { MARKET_LABELS, type MarketCode } from '../lib/markets'
import { PageFrame } from './PageFrame'

// A screen of one market opened by a session that does not work in it: say so instead of an empty list.
export function OtherMarketNotice({ title, market }: { title: string; market: MarketCode }) {
  return (
    <PageFrame title={title} description={`Esta tela é do mercado ${MARKET_LABELS[market]}.`}>
      <div className="warning" role="status">
        {`Esta tela é do mercado ${MARKET_LABELS[market]} e sua conta não trabalha nele. `}
        <Link to="/dashboard">Voltar para Hoje</Link>
      </div>
    </PageFrame>
  )
}
