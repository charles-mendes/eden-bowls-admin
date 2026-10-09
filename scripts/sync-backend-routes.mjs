// Copies the backend route manifest into this repo so the contract test can run offline in CI.
// Usage: npm run contract:sync [-- path/to/eden-bowls-backend]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(root, process.argv[2] ?? '../eden-bowls-backend')
const source = resolve(backend, 'docs/api-routes.json')
const target = resolve(root, 'contracts/backend-routes.json')

if (!existsSync(source)) {
  console.error(`Backend manifest not found at ${source}. Run \`npm run routes:manifest\` in the backend first.`)
  process.exit(1)
}

const key = (route) => `${route.method} ${route.path}`
const next = JSON.parse(readFileSync(source, 'utf8'))
const previous = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : []
const before = new Set(previous.map(key))
const after = new Set(next.map(key))
const added = [...after].filter((route) => !before.has(route))
const removed = [...before].filter((route) => !after.has(route))

writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`)
console.log(`contracts/backend-routes.json: ${next.length} routes (${added.length} added, ${removed.length} removed)`)
for (const route of added) console.log(`  + ${route}`)
for (const route of removed) console.log(`  - ${route}`)
