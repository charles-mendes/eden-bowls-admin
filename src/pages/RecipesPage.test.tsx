import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecipesPage } from './RecipesPage'
import { AuthProvider } from '../contexts/AuthContext'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { seedAuth } from '../test/renderPage'

function Location() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}</p>
}

function renderRecipes() {
  return render(
    <MemoryRouter initialEntries={['/catalog/recipes']}>
      <AuthProvider>
        <Routes>
          <Route path="/catalog/recipes" element={<RecipesPage />} />
          <Route path="/catalog/recipes/:market/:recipeKey" element={<Location />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function rowOf(name: string) {
  return screen.getByRole('link', { name }).closest('tr')!
}

describe('RecipesPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists the recipes of the session market with variations, image and label', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser)
    renderRecipes()

    expect(await screen.findByRole('link', { name: 'Carne' })).toHaveAttribute('href', '/catalog/recipes/BR/beef')
    expect(within(rowOf('Carne')).getByText('beef')).toBeInTheDocument()
    expect(within(rowOf('Carne')).getByText('2/3')).toBeInTheDocument()
    expect(within(rowOf('Carne')).getByText('Imagem cadastrada')).toBeInTheDocument()
    expect(within(rowOf('Carne')).getByText('Rótulo completo')).toBeInTheDocument()
    expect(within(rowOf('Sênior Cordeiro')).getByText('0/0')).toBeInTheDocument()
    expect(within(rowOf('Sênior Cordeiro')).getByText('Sem imagem')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/recipe-content' && call.search === '?market=BR')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Nova receita' })).not.toBeInTheDocument()
  })

  it('filters recipes without image and with an incomplete or missing label', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderRecipes()

    await screen.findByRole('link', { name: 'Carne' })
    await user.click(screen.getByRole('button', { name: 'Sem imagem' }))
    expect(screen.queryByRole('link', { name: 'Carne' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sênior Cordeiro' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rótulo incompleto' }))
    expect(screen.getByRole('link', { name: 'Sênior Cordeiro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Frango' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Carne' })).not.toBeInTheDocument()
  })

  it('registers a recipe with the key suggested from its name and opens its page', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderRecipes()

    await user.click(await screen.findByRole('button', { name: 'Nova receita' }))
    await user.type(screen.getByLabelText('Nome'), 'Sênior Pato')
    expect(screen.getByLabelText('Chave')).toHaveValue('senior-pato')
    await user.click(screen.getByRole('button', { name: 'Cadastrar receita' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/catalog/recipes/BR/senior-pato')
    const post = calls.find((call) => call.method === 'POST')
    expect(post).toMatchObject({ path: '/api/v1/admin/catalog/recipe-content', search: '?market=BR', body: { key: 'senior-pato', name: 'Sênior Pato' } })
  })

  it('keeps what was typed when the key is taken', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderRecipes()

    await user.click(await screen.findByRole('button', { name: 'Nova receita' }))
    await user.type(screen.getByLabelText('Nome'), 'Carne')
    await user.clear(screen.getByLabelText('Chave'))
    await user.type(screen.getByLabelText('Chave'), 'beef')
    await user.click(screen.getByRole('button', { name: 'Cadastrar receita' }))

    expect(await screen.findByText('Já existe uma receita com essa chave neste mercado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Carne')
    expect(screen.getByLabelText('Chave')).toHaveValue('beef')
  })
})
