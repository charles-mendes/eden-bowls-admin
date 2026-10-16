import { describe, expect, it } from 'vitest'
import { getPostLoginPath, isVeterinarianOnly, isOperationalUser, ROLE_OPTIONS } from './roles'

describe('admin roles', () => {
  it('accepts operational roles and rejects customer-only accounts', () => {
    expect(isOperationalUser(['admin'])).toBe(true)
    expect(isOperationalUser(['operator'])).toBe(true)
    expect(isOperationalUser(['veterinarian'])).toBe(true)
    expect(isOperationalUser(['readonly'])).toBe(true)
    expect(isOperationalUser(['customer'])).toBe(false)
    expect(isOperationalUser([])).toBe(false)
  })

  it('detects veterinarian-only accounts', () => {
    expect(isVeterinarianOnly(['veterinarian'])).toBe(true)
    expect(isVeterinarianOnly(['veterinarian', 'operator'])).toBe(false)
    expect(isVeterinarianOnly(['admin'])).toBe(false)
  })

  it('does not treat market permissions as assignable panel roles', () => {
    expect(ROLE_OPTIONS.map((option) => option.value)).toEqual([
      'customer',
      'veterinarian',
      'readonly',
      'operator',
      'admin',
    ])
  })

  it('routes veterinarians to the simulator and others to dashboard or origin', () => {
    expect(getPostLoginPath(['veterinarian'])).toBe('/nutrition/simulate')
    expect(getPostLoginPath(['operator'], '/login')).toBe('/dashboard')
    expect(getPostLoginPath(['operator'], '/users', { mustChangePassword: true })).toBe('/account/password')
  })
})
