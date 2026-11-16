import { useId, useState, type FormEvent } from 'react'
import { Dialog } from '../Dialog'
import { useAuth } from '../../contexts/AuthContext'
import { fillRecipientName, recipientNameError } from '../../lib/recipientName'

// operator-fills-recipient-name: one field, empty. The account name is offered by a button, never pre-filled,
// because the recipient may be someone else (a gift).
export function RecipientNameDialog({ subscriptionId, accountName, onClose, onSaved }: {
  subscriptionId: string | number
  accountName?: string | null
  onClose: () => void
  // The page shows the message and reloads: after a save, or when someone filled the name in between.
  onSaved: (message: string) => void
}) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const errorId = useId()

  const save = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !name.trim()) return
    try {
      setSaving(true)
      setError('')
      const saved = await fillRecipientName(token, subscriptionId, name.trim())
      onSaved(`Nome de quem recebe salvo: ${saved.recipient_name}.`)
    } catch (requestError) {
      const failure = recipientNameError(requestError)
      setSaving(false)
      if (failure.alreadyFilled) {
        // Someone filled it in between: the page reloads and shows that name.
        onSaved(failure.message)
        return
      }
      setError(failure.message)
    }
  }

  return (
    <Dialog
      open
      title="Informar quem recebe"
      description="Fica nesta assinatura e vale para os próximos pedidos. O nome da conta não muda. Se for presente, confirme com o cliente."
      onClose={onClose}
      footer={(
        <>
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit" form="recipient-name-form" disabled={saving || !name.trim()}>
            {saving ? 'Salvando...' : 'Salvar nome'}
          </button>
        </>
      )}
    >
      <form id="recipient-name-form" className="recipient-name-form" onSubmit={(event) => void save(event)}>
        <label>
          Nome de quem recebe
          <input
            value={name}
            maxLength={60}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error ? <p id={errorId} className="form-error" role="alert">{error}</p> : null}
        {accountName ? (
          <button className="link-button" type="button" onClick={() => setName(accountName)}>
            Usar nome da conta ({accountName})
          </button>
        ) : null}
      </form>
    </Dialog>
  )
}
