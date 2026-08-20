import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NutritionSimulatePage } from './NutritionSimulatePage'
import { nutritionistUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('NutritionSimulatePage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('POSTs a simulation payload with Bearer and shows the result', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(nutritionistUser)
    renderAuthedPage(<NutritionSimulatePage />, '/nutrition/simulate')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Pet name'), 'Luna')
    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    await waitFor(() => {
      expect(screen.getByText('900 kcal')).toBeInTheDocument()
    })

    const simulate = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/nutrition/simulate')
    expect(simulate?.authorization).toBe('Bearer access-token')
    expect(simulate?.body).toMatchObject({
      country: 'US',
      pet: { name: 'Luna', type: 'dog', life_stage: 'adult', weight: 20 },
    })
  })
})
