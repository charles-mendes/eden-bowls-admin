import { MARKET_LABELS, hasBothMarkets, sessionMarkets, stripeAccountForMarket, type MarketCode } from '../lib/markets'
import type { AdminUser } from '../contexts/AuthContext'

type MarketSelectProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  user: AdminUser | null
  includeAll?: boolean
  allLabel?: string
  disabled?: boolean
}

export function MarketSelect({
  label = 'Mercado',
  value,
  onChange,
  user,
  includeAll = false,
  allLabel = 'Todos',
  disabled = false,
}: MarketSelectProps) {
  const markets = sessionMarkets(user)
  const both = hasBothMarkets(user)
  const locked = !both

  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        disabled={disabled || locked}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeAll && both ? <option value="">{allLabel}</option> : null}
        {markets.map((market) => (
          <option key={market} value={market}>{MARKET_LABELS[market]}</option>
        ))}
      </select>
    </label>
  )
}

type AccountSelectProps = {
  value: string
  onChange: (value: string) => void
  user: AdminUser | null
  includeAll?: boolean
  disabled?: boolean
}

export function AccountSelect({
  value,
  onChange,
  user,
  includeAll = false,
  disabled = false,
}: AccountSelectProps) {
  const markets = sessionMarkets(user)
  const both = hasBothMarkets(user)
  const locked = !both

  return (
    <label>
      Conta
      <select
        aria-label="Conta"
        value={value}
        disabled={disabled || locked}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeAll && both ? <option value="all">todas</option> : null}
        {markets.map((market: MarketCode) => (
          <option key={market} value={stripeAccountForMarket(market)}>{market}</option>
        ))}
      </select>
    </label>
  )
}
