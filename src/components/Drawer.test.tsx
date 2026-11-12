import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'

function Host({ onRequestClose }: { onRequestClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      <input aria-label="Campo da página" />
      <Drawer
        open={open}
        title="Conteúdo"
        onRequestClose={() => { onRequestClose?.(); setOpen(false) }}
        notice={<p>Aviso</p>}
      >
        <input aria-label="Primeiro" />
        <button type="button" disabled>Desligado</button>
        <input aria-label="Último" />
      </Drawer>
    </>
  )
}

describe('Drawer', () => {
  it('focuses the close button and gives the focus back on Escape', async () => {
    const user = userEvent.setup()
    const onRequestClose = vi.fn()
    render(<Host onRequestClose={onRequestClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('dialog', { name: 'Conteúdo' })).toBeInTheDocument()
    expect(screen.getByText('Aviso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onRequestClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('keeps Tab inside the panel', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    screen.getByLabelText('Último').focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByLabelText('Último')).toHaveFocus()
    expect(screen.getByLabelText('Campo da página')).not.toHaveFocus()
  })

  it('asks its owner to close on a click outside', async () => {
    const user = userEvent.setup()
    const onRequestClose = vi.fn()
    render(<Host onRequestClose={onRequestClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await user.click(screen.getByLabelText('Primeiro'))
    expect(onRequestClose).not.toHaveBeenCalled()

    await user.pointer({ keys: '[MouseLeft]', target: document.querySelector('.drawer-overlay')! })
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })
})
