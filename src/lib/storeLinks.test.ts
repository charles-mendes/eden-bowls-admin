import { describe, expect, it } from 'vitest'
import { resolveStoreEnvironment, storeHomeLinks, storeTestimonialsLinks } from './storeLinks'

describe('storeLinks', () => {
  it('reads the environment from the panel host', () => {
    expect(resolveStoreEnvironment('localhost')).toBe('local')
    expect(resolveStoreEnvironment('127.0.0.1')).toBe('local')
    expect(resolveStoreEnvironment('qa-admin.edenbowls.com')).toBe('qa')
    expect(resolveStoreEnvironment('admin.edenbowls.com')).toBe('production')
  })

  it('links local and QA to their single storefront', () => {
    expect(storeHomeLinks('local', 'BR')).toEqual([{ country: null, url: 'http://localhost:5173/' }])
    expect(storeHomeLinks('qa')).toEqual([{ country: null, url: 'https://qa.edenbowls.com/' }])
  })

  it('links production to the storefront of each market, or only the chosen one', () => {
    expect(storeHomeLinks('production')).toEqual([
      { country: 'BR', url: 'https://www.edenbowls.com.br/' },
      { country: 'US', url: 'https://www.edenbowls.com/' },
    ])
    expect(storeHomeLinks('production', 'US')).toEqual([{ country: 'US', url: 'https://www.edenbowls.com/' }])
  })

  it('opens each storefront at its testimonials section', () => {
    expect(storeTestimonialsLinks('qa')).toEqual([{ country: null, url: 'https://qa.edenbowls.com/#depoimentos' }])
    expect(storeTestimonialsLinks('production', 'BR')).toEqual([{ country: 'BR', url: 'https://www.edenbowls.com.br/#depoimentos' }])
  })
})
