import { describe, expect, it } from 'vitest'
import { API_PREFIX, DYNAMIC_SEGMENT, backendRoutes, isKnownRoute, pathMatchesRoute } from './apiContract'

const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const mocks = import.meta.glob<string>(['/src/test/mockAdminFetch.ts', '/e2e/helpers/mockAdminApi.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

type Found = { file: string; method: string | null; path: string }

// Text of the call that starts at `open` (an opening parenthesis), skipping over string contents.
function callArguments(text: string, open: number) {
  let depth = 0
  let quote = ''
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]
    if (quote) {
      if (char === '\\') index += 1
      else if (char === quote) quote = ''
      continue
    }
    if (char === '\'' || char === '"' || char === '`') quote = char
    else if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, index)
    }
  }
  return ''
}

const EXPRESSION = '\u0000'

// Replaces each `${…}` (braces may nest) with one marker character.
function collapseExpressions(raw: string) {
  let out = ''
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] === '$' && raw[index + 1] === '{') {
      let depth = 0
      for (index += 1; index < raw.length; index += 1) {
        if (raw[index] === '{') depth += 1
        else if (raw[index] === '}' && --depth === 0) break
      }
      out += EXPRESSION
    } else {
      out += raw[index]
    }
  }
  return out
}

// `/admin/users/${id}` → `/admin/users/{dynamic}`; an expression appended to a segment is a query string.
function normalizeTemplate(raw: string) {
  const path = collapseExpressions(raw).split('?')[0]
  return path
    .split('/')
    .map((segment) => {
      if (segment === EXPRESSION) return DYNAMIC_SEGMENT
      return segment.replace(new RegExp(`${EXPRESSION}+$`), '')
    })
    .join('/')
}

function methodOf(args: string): string | null {
  const match = args.match(/method:\s*([^,}\n]+)/)
  if (!match) return 'GET'
  const literal = match[1].trim().match(/^['"](\w+)['"]$/)
  return literal ? literal[1].toUpperCase() : null
}

function sourceCalls(): Found[] {
  const found: Found[] = []
  for (const [file, text] of Object.entries(sources)) {
    const pattern = /\b(apiRequest(?:<[^>(]*>)?|fetch)\(/g
    for (const match of text.matchAll(pattern)) {
      const args = callArguments(text, (match.index ?? 0) + match[0].length - 1)
      const literal = args.match(/^\s*(['`])((?:\\.|(?!\1).)*)\1/s)
      if (!literal) continue
      let raw = literal[2]
      if (match[1] === 'fetch') {
        if (!raw.startsWith('${getApiBaseUrl()}')) continue
        raw = raw.slice('${getApiBaseUrl()}'.length)
      }
      // Paths that start with a variable are checked at run time by the Vitest mock instead.
      if (!raw.startsWith('/')) continue
      found.push({ file, method: methodOf(args.slice(literal[0].length)), path: `${API_PREFIX}${normalizeTemplate(raw)}` })
    }
  }
  return found
}

type MockRoute = { file: string; method: string | null; kind: 'exact' | 'prefix' | 'regex'; value: string }

function mockRoutes(): MockRoute[] {
  const found: MockRoute[] = []
  for (const [file, text] of Object.entries(mocks)) {
    for (const line of text.split('\n')) {
      const method = line.match(/method === '(\w+)'/)?.[1] ?? null
      for (const match of line.matchAll(/path === '([^']+)'/g)) found.push({ file, method, kind: 'exact', value: match[1] })
      for (const match of line.matchAll(/path\.startsWith\('([^']+)'\)/g)) found.push({ file, method, kind: 'prefix', value: match[1] })
      for (const match of line.matchAll(/\/(\^\\\/api\\\/v1[^ ]*?\$)\/\.test\(path\)/g)) found.push({ file, method, kind: 'regex', value: match[1] })
    }
  }
  return found
}

function mockIsKnown(mock: MockRoute) {
  const methodOk = (method: string) => mock.method === null || method === mock.method
  if (mock.kind === 'exact') return isKnownRoute(mock.method, mock.value)
  if (mock.kind === 'prefix') {
    return backendRoutes.some((route) => methodOk(route.method) && (route.path.startsWith(mock.value) || pathMatchesRoute(route.path, mock.value)))
  }
  const pattern = new RegExp(mock.value)
  return backendRoutes.some((route) => methodOk(route.method) && pattern.test(route.path.replace(/:[^/]+/g, '123')))
}

describe('API route contract', () => {
  it('has the backend manifest', () => {
    expect(backendRoutes.length).toBeGreaterThan(100)
  })

  it('finds the calls it is meant to check', () => {
    const paths = sourceCalls().map((call) => `${call.method ?? '*'} ${call.path}`)
    expect(paths).toContain('GET /api/v1/admin/markets/conflicts')
    expect(paths).toContain('GET /api/v1/admin/billing/webhooks/health')
    expect(paths).toContain('GET /api/v1/admin/users/{dynamic}')
    expect(mockRoutes().length).toBeGreaterThan(50)
  })

  it('every API path in panel source exists in the backend', () => {
    const missing = sourceCalls()
      .filter((call) => !isKnownRoute(call.method, call.path))
      .map((call) => `${call.method ?? '*'} ${call.path} (${call.file})`)
    expect(missing).toEqual([])
  })

  it('every route answered by the Vitest and Playwright mocks exists in the backend', () => {
    const missing = mockRoutes()
      .filter((mock) => !mockIsKnown(mock))
      .map((mock) => `${mock.method ?? '*'} ${mock.kind} ${mock.value} (${mock.file})`)
    expect(missing).toEqual([])
  })
})
