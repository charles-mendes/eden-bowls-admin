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

    expect(screen.getByLabelText('Weight (lb)')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ideal' })).toBeInTheDocument()
    expect(screen.getByText('Ex.: 2-month-old puppy')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Pet name'), 'Luna')
    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    await waitFor(() => {
      expect(screen.getByText('900 kcal')).toBeInTheDocument()
    })

    const simulate = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/nutrition/simulate')
    expect(simulate?.authorization).toBe('Bearer access-token')
    expect(simulate?.body).toMatchObject({
      country: 'US',
      pet: {
        name: 'Luna',
        type: 'dog',
        life_stage: 'adult',
        age: 4,
        age_years: 4,
        age_months: 0,
        weight: 20,
        weight_unit: 'lb',
      },
    })
  })

  it('sends age in months and localizes BR fields', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(nutritionistUser)
    renderAuthedPage(<NutritionSimulatePage />, '/nutrition/simulate')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Country'), 'BR')
    await waitFor(() => {
      expect(screen.getByLabelText('Peso (kg)')).toBeInTheDocument()
    })

    expect(screen.getByRole('option', { name: 'BAIXO' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'ADEQUADO' })).toBeInTheDocument()
    expect(screen.getByText('Ex.: filhote de 2 meses')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Unidade da idade'), 'Meses')
    await user.clear(screen.getByLabelText('Idade'))
    await user.type(screen.getByLabelText('Idade'), '2')
    await user.click(screen.getByRole('button', { name: 'Calcular' }))

    await waitFor(() => {
      expect(screen.getByText('900 kcal')).toBeInTheDocument()
    })

    const simulate = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/nutrition/simulate')
    expect(simulate?.body).toMatchObject({
      country: 'BR',
      pet: {
        age: 0,
        age_years: 0,
        age_months: 2,
        weight_unit: 'kg',
      },
    })
  })
})
