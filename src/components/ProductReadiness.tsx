import type { ReadinessTarget, ReadinessStep } from '../lib/productReadiness'

const TARGET_TEXT: Record<Exclude<ReadinessTarget, 'publicar'>, string> = {
  imagens: 'Abrir Imagens',
  apresentacao: 'Abrir Apresentação',
  rotulo: 'Abrir Rótulo',
  variacoes: 'Abrir Variações',
}

// One line of steps and, below it, only the next one with what is missing and the button that solves it.
// The other pending steps open their tab from the step itself.
export function ProductReadiness({ steps, onOpen, canPublish }: {
  steps: ReadinessStep[]
  onOpen: (target: ReadinessTarget) => void
  canPublish: boolean
}) {
  const doneCount = steps.filter((step) => step.done).length
  const ready = doneCount === steps.length
  const next = steps.find((step) => !step.done)
  // Publicar stays in the page header, so the step only points to it.
  const nextTarget = next?.target && next.target !== 'publicar' ? next.target : null
  const nextDetail = next?.target === 'publicar' && !canPublish ? 'Falta publicar o produto.' : next?.detail

  return (
    <section className="section-card readiness-card" aria-labelledby="readiness-title">
      <div className="readiness-head">
        <h3 id="readiness-title">{ready ? 'Produto na loja' : 'O que falta para aparecer na loja'}</h3>
        <span className={ready ? 'badge-success' : 'badge-warning'}>{doneCount} de {steps.length}</span>
        <div
          className="readiness-bar"
          role="progressbar"
          aria-label="Itens concluídos"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      {ready ? (
        <p className="muted readiness-ready">Tudo pronto: o produto está publicado e tem variação ativa.</p>
      ) : (
        <>
          <ol className="readiness-steps">
            {steps.map((step) => {
              const state = step.done ? 'done' : step.id === next?.id ? 'next' : 'pending'
              const body = (
                <>
                  <span className="readiness-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
                  <span className="readiness-title">{step.title}</span>
                  <span className="sr-only">{step.done ? ' (concluído)' : ' (pendente)'}</span>
                </>
              )
              const opensTab = !step.done && step.target && step.target !== 'publicar' && step.id !== next?.id
              return (
                <li key={step.id} className={`readiness-step ${state}`}>
                  {opensTab ? (
                    <button className="readiness-step-inner" type="button" title={step.detail} onClick={() => onOpen(step.target!)}>
                      {body}
                    </button>
                  ) : <span className="readiness-step-inner">{body}</span>}
                </li>
              )
            })}
          </ol>
          {next ? (
            <div className="readiness-next-step">
              <div className="readiness-text">
                <span className="readiness-next-title">
                  <span className="badge-info">Próximo passo</span>
                  {next.title}
                </span>
                <span className="readiness-detail">{nextDetail}</span>
              </div>
              {nextTarget ? (
                <button
                  className="primary-button readiness-action"
                  type="button"
                  aria-label={`${TARGET_TEXT[nextTarget]} (${next.title})`}
                  onClick={() => onOpen(nextTarget)}
                >
                  {TARGET_TEXT[nextTarget]}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
