import { describe, expect, it } from 'vitest'
import { getPostLoginPath, isNutritionistOnly, isOperationalUser, ROLE_OPTIONS } from './roles'

describe('admin roles', () => {
  it('accepts operational roles and rejects customer-only accounts', () => {
    expect(isOperationalUser(['admin'])).toBe(true)
    expect(isOperationalUser(['operator'])).toBe(true)
    expect(isOperationalUser(['nutritionist'])).toBe(true)
    expect(isOperationalUser(['readonly'])).toBe(true)
    expect(isOperationalUser(['customer'])).toBe(false)
    expect(isOperationalUser([])).toBe(false)
  })

  it('detects nutritionist-only accounts', () => {
    expect(isNutritionistOnly(['nutritionist'])).toBe(true)
    expect(isNutritionistOnly(['nutritionist', 'operator'])).toBe(false)
    expect(isNutritionistOnly(['admin'])).toBe(false)
  })

  it('does not treat market permissions as assignable panel roles', () => {
    expect(ROLE_OPTIONS.map((option) => option.value)).toEqual([
      'customer',
      'nutritionist',
      'readonly',
      'operator',
      'admin',
    ])
  })

  it('routes nutritionists to the simulator and others to dashboard or origin', () => {
    expect(getPostLoginPath(['nutritionist'])).toBe('/nutrition/simulate')
    expect(getPostLoginPath(['operator'], '/login')).toBe('/dashboard')
    expect(getPostLoginPath(['operator'], '/users', { mustChangePassword: true })).toBe('/account/password')
  })
})
