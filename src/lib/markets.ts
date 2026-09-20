export type MarketCode = 'BR' | 'US'
export type StripeAccount = 'br' | 'us'
export type MarketCurrency = 'BRL' | 'USD'

const MARKET_ORDER: MarketCode[] = ['BR', 'US']

export const MARKET_LABELS: Record<MarketCode, string> = {
  BR: 'Brasil',
  US: 'Estados Unidos',
}

type SessionUser = {
  markets?: string[] | null
} | null | undefined

export function sessionMarkets(user: SessionUser): MarketCode[] {
  const raw = Array.isArray(user?.markets) ? user.markets : []
  const allowed = new Set(raw.filter((value): value is MarketCode => value === 'BR' || value === 'US'))
  return MARKET_ORDER.filter((market) => allowed.has(market))
}

export function hasBothMarkets(user: SessionUser) {
  const markets = sessionMarkets(user)
  return markets.includes('BR') && markets.includes('US')
}

export function defaultMarket(user: SessionUser): MarketCode | null {
  const markets = sessionMarkets(user)
  if (markets.includes('BR')) return 'BR'
  if (markets.includes('US')) return 'US'
  return null
}

export function stripeAccountForMarket(market: MarketCode): StripeAccount {
  return market === 'US' ? 'us' : 'br'
}

export function currencyForMarket(market: MarketCode): MarketCurrency {
  return market === 'US' ? 'USD' : 'BRL'
}

export function defaultStripeAccount(user: SessionUser): StripeAccount | null {
  const market = defaultMarket(user)
  return market ? stripeAccountForMarket(market) : null
}

export function isProfileInScope(flag: boolean | null | undefined) {
  return flag === true
}

export function staffMarketRequired(role: string) {
  return role !== 'admin' && role !== 'customer'
}
