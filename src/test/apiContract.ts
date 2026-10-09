// Checks panel API calls against the backend route manifest (contracts/backend-routes.json,
// refreshed with `npm run contract:sync`). A mock that answers a route the backend does not
// have would otherwise hide the missing route until an admin hits "Route not found".

export type ContractRoute = { method: string; path: string }

export const API_PREFIX = '/api/v1'
// Stands for a segment built at run time, e.g. `/admin/users/${id}`.
export const DYNAMIC_SEGMENT = '{dynamic}'

const manifestModule = import.meta.glob<ContractRoute[]>('/contracts/backend-routes.json', { import: 'default', eager: true })
export const backendRoutes: ContractRoute[] = Object.values(manifestModule)[0] ?? []

const segments = (path: string) => path.split('/').filter(Boolean)

function segmentMatches(routeSegment: string, callSegment: string) {
  if (routeSegment.startsWith(':')) return callSegment !== ''
  return callSegment !== DYNAMIC_SEGMENT && routeSegment === callSegment
}

export function pathMatchesRoute(routePath: string, callPath: string) {
  const route = segments(routePath)
  const call = segments(callPath)
  return route.length === call.length && route.every((segment, index) => segmentMatches(segment, call[index]))
}

// `method` null means the caller could not tell the method statically: any method matches.
export function isKnownRoute(method: string | null, path: string, routes = backendRoutes) {
  return routes.some((route) => (method === null || route.method === method.toUpperCase()) && pathMatchesRoute(route.path, path))
}

const violations: string[] = []

export function checkMockedCall(method: string, path: string) {
  if (!path.startsWith(`${API_PREFIX}/`)) return
  if (!isKnownRoute(method, path)) violations.push(`${method.toUpperCase()} ${path}`)
}

export function takeContractViolations() {
  return violations.splice(0, violations.length)
}
