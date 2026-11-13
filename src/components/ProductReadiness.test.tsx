import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProductReadiness, productReadinessSteps, type ReadinessInput } from './ProductReadiness'

const emptyBr: ReadinessInput = { published: false, planCountry: 'BR', content: { imageUrl: null, presentationReady: false, labelStatus: 'missing', labelMissing: [] }, variations: [] }

const stepState = (input: ReadinessInput) => Object.fromEntries(productReadinessSteps(input).map((step) => [step.id, step.done]))

describe('productReadinessSteps', () => {
  it('lists every step of a new BR product as pending, without the label', () => {
    expect(stepState(emptyBr)).toEqual({ image: false, presentation: false, variation: false, 'variation-active': false, published: false })
  })

  it('asks for the label on a US product and names the missing fields', () => {
    const steps = productReadinessSteps({ ...emptyBr, planCountry: 'US', content: { ...emptyBr.content!, labelStatus: 'incomplete', labelMissing: ['ingredients', 'notices'] } })
    expect(steps.find((step) => step.id === 'label')).toMatchObject({ done: false, detail: 'Falta no rótulo: ingredientes e avisos.' })
  })

  it('names what each inactive variation lacks', () => {
    const steps = productReadinessSteps({
      ...emptyBr,
      variations: [
        { label: '300 g', active: false, missing: ['preço', 'NCM'], finalImageReady: false, labelDataReady: false },
        { label: '500 g', active: false, missing: ['NCM'], finalImageReady: false, labelDataReady: false },
      ],
    })
    expect(steps.find((step) => step.id === 'variation-data')).toMatchObject({ done: false, detail: '300 g: falta preço e NCM; 500 g: falta NCM.' })
  })

  it('takes the per-variation photo confirmation as the photo', () => {
    const state = stepState({ ...emptyBr, variations: [{ label: '300 g', active: false, missing: [], finalImageReady: true, labelDataReady: false }] })
    expect(state.image).toBe(true)
    expect(state['variation-data']).toBe(true)
  })

  it('is complete for a published product with an active variation and its content', () => {
    const state = stepState({
      published: true,
      planCountry: 'BR',
      content: { imageUrl: '/recipe-images/beef.webp', presentationReady: true, labelStatus: 'missing', labelMissing: [] },
      variations: [{ label: '300 g', active: true, missing: [], finalImageReady: false, labelDataReady: false }],
    })
    expect(Object.values(state).every(Boolean)).toBe(true)
  })
})

describe('ProductReadiness', () => {
  it('marks the next step and opens its tab', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<ProductReadiness steps={productReadinessSteps({ ...emptyBr, content: { ...emptyBr.content!, imageUrl: '/x.webp' } })} onOpen={onOpen} canPublish />)

    expect(screen.getByRole('heading', { name: 'O que falta para aparecer na loja' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Itens concluídos' })).toHaveAttribute('aria-valuenow', '1')
    const next = screen.getByText('Próximo passo').closest('li')!
    expect(within(next).getByText('Apresentação da receita')).toBeInTheDocument()

    await user.click(within(next).getByRole('button', { name: 'Abrir Apresentação (Apresentação da receita)' }))
    expect(onOpen).toHaveBeenCalledWith('apresentacao')
  })

  it('hides Publicar without write permission and shows the ready state', () => {
    const pending = productReadinessSteps(emptyBr)
    const { rerender } = render(<ProductReadiness steps={pending} onOpen={vi.fn()} canPublish={false} />)
    expect(screen.queryByRole('button', { name: /^Publicar/ })).not.toBeInTheDocument()

    rerender(<ProductReadiness steps={pending.map((step) => ({ ...step, done: true }))} onOpen={vi.fn()} canPublish />)
    expect(screen.getByRole('heading', { name: 'Produto na loja' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
