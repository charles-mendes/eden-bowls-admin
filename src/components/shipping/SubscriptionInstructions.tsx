import { useId, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  DELIVERY_INSTRUCTIONS_ERROR,
  DELIVERY_INSTRUCTIONS_MAX_LENGTH,
  deliveryInstructionsError,
  deliveryInstructionsLength,
  instructionsSourceText,
  isValidDeliveryInstructions,
  normalizeDeliveryInstructions,
  oneLineInstructions,
  saveSubscriptionInstructions,
  type DeliveryInstructionsSource,
} from '../../lib/deliveryInstructions'

// delivery-instructions: what the courier and whoever packs the UPS box read for this subscription. Editing
// changes only this subscription, never the customer profile or another subscription.
export function SubscriptionInstructions({ subscriptionId, text, source, canWrite, onSaved }: {
  subscriptionId: string | number
  text?: string | null
  source?: DeliveryInstructionsSource
  canWrite: boolean
  onSaved: (message: string) => void
}) {
  const { token } = useAuth()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fieldId = useId()
  const errorId = useId()

  const startEditing = () => {
    setValue(source === 'subscription' ? text || '' : '')
    setError('')
    setEditing(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    if (!isValidDeliveryInstructions(value)) {
      setError(DELIVERY_INSTRUCTIONS_ERROR)
      return
    }
    try {
      setSaving(true)
      setError('')
      const saved = await saveSubscriptionInstructions(token, subscriptionId, normalizeDeliveryInstructions(value))
      onSaved(saved?.delivery_instructions ? 'Instruções da assinatura salvas.' : 'Instruções da assinatura removidas.')
      setEditing(false)
    } catch (requestError) {
      setError(deliveryInstructionsError(requestError))
    } finally {
      setSaving(false)
    }
  }

  const sourceText = instructionsSourceText(source)
  const length = deliveryInstructionsLength(value)

  if (editing) {
    return (
      <form className="stack" onSubmit={(event) => void save(event)}>
        <label htmlFor={fieldId}>Instruções desta assinatura</label>
        <input
          id={fieldId}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="Portão, local de entrega, cuidado com o pet"
          onChange={(event) => { setValue(oneLineInstructions(event.target.value)); setError('') }}
        />
        <p className={length > DELIVERY_INSTRUCTIONS_MAX_LENGTH ? 'form-error' : 'muted'} data-testid="subscription-instructions-counter">
          {length}/{DELIVERY_INSTRUCTIONS_MAX_LENGTH}
        </p>
        {error ? <p id={errorId} className="form-error" role="alert">{error}</p> : null}
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={() => { setEditing(false); setError('') }}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar instruções'}</button>
        </div>
      </form>
    )
  }

  return (
    <div className="stack">
      {text ? (
        <p>
          <strong>{text}</strong>
          {sourceText ? <span className="muted"> ({sourceText})</span> : null}
        </p>
      ) : (
        <p className="muted">Sem instruções.</p>
      )}
      {source === 'profile' ? (
        <p className="muted">Esta assinatura não tem instruções próprias. O texto vem do perfil do cliente, que está no mesmo endereço.</p>
      ) : null}
      {canWrite ? (
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={startEditing}>
            {source === 'subscription' ? 'Editar instruções' : 'Escrever instruções'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
