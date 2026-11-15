// Where the storefront of this panel's environment lives, to open the result of an admin change.

export type StoreEnvironment = 'local' | 'qa' | 'production'

export type StoreHomeLink = {
  // null: one storefront shows both markets, by the region the visitor picks.
  country: 'BR' | 'US' | null
  url: string
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export const STORE_HOME_URLS = {
  local: 'http://localhost:5173/',
  qa: 'https://qa.edenbowls.com/',
  productionBr: 'https://www.edenbowls.com.br/',
  productionUs: 'https://www.edenbowls.com/',
} as const

// The anchor of the storefront home's testimonials section (TestimonialsSection in eden-bowls).
export const STORE_TESTIMONIALS_ANCHOR = '#depoimentos'

export const STORE_ENVIRONMENT_LABELS: Record<StoreEnvironment, string> = {
  local: 'local',
  qa: 'QA',
  production: 'produção',
}

// The panel host decides: localhost is local, qa-admin.edenbowls.com is QA, any other host is production.
export function resolveStoreEnvironment(
  hostname: string = typeof window === 'undefined' ? '' : window.location.hostname,
): StoreEnvironment {
  const host = hostname.trim().toLowerCase()
  if (!host || LOCAL_HOSTS.has(host) || host.endsWith('.localhost')) return 'local'
  if (host.startsWith('qa-') || host.startsWith('qa.') || host.includes('.qa.')) return 'qa'
  return 'production'
}

// The storefront home opened at its testimonials section.
export function storeTestimonialsLinks(environment: StoreEnvironment, country?: string): StoreHomeLink[] {
  return storeHomeLinks(environment, country).map((link) => ({ ...link, url: `${link.url}${STORE_TESTIMONIALS_ANCHOR}` }))
}

// country narrows production to one market; local and QA have a single storefront for both.
export function storeHomeLinks(environment: StoreEnvironment, country?: string): StoreHomeLink[] {
  if (environment === 'local') return [{ country: null, url: STORE_HOME_URLS.local }]
  if (environment === 'qa') return [{ country: null, url: STORE_HOME_URLS.qa }]

  const links: StoreHomeLink[] = [
    { country: 'BR', url: STORE_HOME_URLS.productionBr },
    { country: 'US', url: STORE_HOME_URLS.productionUs },
  ]
  const wanted = String(country || '').toUpperCase()
  return wanted === 'BR' || wanted === 'US' ? links.filter((link) => link.country === wanted) : links
}
