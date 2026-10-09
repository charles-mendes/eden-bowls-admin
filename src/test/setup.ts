import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { takeContractViolations } from './apiContract'

afterEach(() => {
  cleanup()
  const violations = takeContractViolations()
  if (violations.length > 0) {
    throw new Error(`Mocked API calls not in contracts/backend-routes.json:\n${[...new Set(violations)].join('\n')}`)
  }
})
