import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackFormPage } from './FeedbackFormPage'
import { AuthProvider } from '../contexts/AuthContext'
import { operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { seedAuth } from '../test/renderPage'

describe('FeedbackFormPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a feedback for Brazil', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    render(
      <MemoryRouter initialEntries={['/feedbacks/new']}>
        <AuthProvider>
          <Routes>
            <Route path="/feedbacks/new" element={<FeedbackFormPage />} />
            <Route path="/feedbacks" element={<div>feedbacks-list</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    })
    await user.type(screen.getByPlaceholderText('Nome do cliente'), 'Maria Souza')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), 'tutora')
    await user.selectOptions(screen.getByRole('combobox', { name: 'País' }), 'BR')
    await user.type(screen.getByPlaceholderText('Nova York, São Paulo'), 'São Paulo')
    await user.type(screen.getByRole('textbox', { name: 'Comentário' }), 'Comida fresca de verdade.')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('feedbacks-list')).toBeInTheDocument()
    })

    const created = findCall(calls, 'POST', '/admin/feedbacks')
    expect(created?.body).toMatchObject({
      name: 'Maria Souza',
      category: 'tutora',
      country: 'BR',
      place: 'São Paulo',
      comment: 'Comida fresca de verdade.',
      active: true,
    })
  })

  it('loads an existing feedback for edit', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    render(
      <MemoryRouter initialEntries={['/feedbacks/1']}>
        <AuthProvider>
          <Routes>
            <Route path="/feedbacks/:id" element={<FeedbackFormPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument()
    })
    expect(findCall(calls, 'GET', '/admin/feedbacks/1')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'País' })).toHaveValue('BR')
    expect(screen.getByDisplayValue('São Paulo')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Ativo' })).toBeChecked()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Remover foto atual' })).not.toBeChecked()
    expect(screen.getByAltText('Pré-visualização da foto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
  })

  it('deactivates a feedback from the detail page', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    render(
      <MemoryRouter initialEntries={['/feedbacks/1']}>
        <AuthProvider>
          <Routes>
            <Route path="/feedbacks/:id" element={<FeedbackFormPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Desativar' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() => {
      expect(findCall(calls, 'PATCH', '/admin/feedbacks/1/active')?.body).toEqual({ active: false })
    })
    expect(screen.getByText('Feedback desativado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
  })
})
