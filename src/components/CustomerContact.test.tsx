import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CustomerContact } from './CustomerContact'
import { customerContact, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderWithAuth, } from '../test/renderWithAuth'
import { seedAuth } from '../test/renderPage'

describe('CustomerContact', () => {
  it('saves a contact and shows it as the latest', async () => {
    const mock = installAdminFetchMock(operatorWriteUser)
    const user = userEvent.setup()
    seedAuth()
    renderWithAuth(<CustomerContact subscriptionId="sub-row-1" name="Davi Rocha" phone="+55 41 99999-0000" reason="payment_failed" />)

    await user.click(await screen.findByRole('button', { name: 'Registrar contato' }))
    expect(screen.getByText('+55 41 99999-0000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar telefone' })).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).toHaveValue('payment_failed')
    await user.click(screen.getByLabelText('Sem resposta'))
    await user.type(screen.getByLabelText('Nota (opcional)'), 'Mandei o link')
    await user.click(screen.getByRole('button', { name: 'Salvar contato' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const post = mock.calls.find((call) => call.method === 'POST' && call.path.endsWith('/contacts'))
    expect(post?.body).toEqual({ reason: 'payment_failed', outcome: 'no_answer', note: 'Mandei o link' })
    expect(screen.getByText(/Contatado hoje, .*sem resposta, por/)).toBeInTheDocument()
  })

  it('keeps the dialog and the fields when the API refuses', async () => {
    installAdminFetchMock(operatorWriteUser, { contactError: { status: 422, code: 'invalid_contact', field: 'note' } })
    const user = userEvent.setup()
    seedAuth()
    renderWithAuth(<CustomerContact subscriptionId="sub-row-1" name="Davi Rocha" />)

    await user.click(await screen.findByRole('button', { name: 'Registrar contato' }))
    expect(screen.getByText('Sem telefone')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Motivo'), 'late')
    await user.click(screen.getByLabelText('Cliente vai resolver'))
    await user.type(screen.getByLabelText('Nota (opcional)'), 'Volta amanhã')
    await user.click(screen.getByRole('button', { name: 'Salvar contato' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A nota tem até 500 caracteres.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).toHaveValue('late')
    expect(screen.getByLabelText('Cliente vai resolver')).toBeChecked()
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('Volta amanhã')
  })

  it('shows the last contact to a readonly user without the button', async () => {
    installAdminFetchMock(readonlyUser)
    seedAuth()
    renderWithAuth(<CustomerContact subscriptionId="sub-row-1" name="Davi Rocha" lastContact={customerContact as never} />)

    expect(await screen.findByText(/sem resposta, por ops@edenbowls.com/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar contato' })).not.toBeInTheDocument()
  })
})
