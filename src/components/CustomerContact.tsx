import { useState, type FormEvent } from 'react'
import { CopyButton } from './CopyButton'
import { Dialog } from './Dialog'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  CONTACT_NOTE_MAX,
  CONTACT_OUTCOMES,
  CONTACT_REASONS,
  contactErrorText,
  contactsPath,
  lastContactText,
  type ContactOutcome,
  type ContactReason,
  type CustomerContact as Contact,
} from '../lib/customerContacts'

export const CONTACT_PERMISSION = 'customers.contact.write'

type Props = {
  subscriptionId: string | number
  name: string
  phone?: string | null
  reason?: ContactReason
  lastContact?: Contact | null
  // Hides the last contact line when the screen shows the whole history instead.
  showLast?: boolean
  onSaved?: (contact: Contact) => void
}

// "Registrar contato": one WhatsApp contact with the reason, the outcome and an optional note.
export function CustomerContact({ subscriptionId, name, phone, reason: suggested, lastContact = null, showLast = true, onSaved }: Props) {
  const { token, hasPermission } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ContactReason | ''>(suggested ?? '')
  const [outcome, setOutcome] = useState<ContactOutcome | ''>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [latest, setLatest] = useState<Contact | null>(lastContact)
  const canWrite = hasPermission(CONTACT_PERMISSION)
  const shown = latest ?? lastContact

  const start = () => {
    setReason(suggested ?? '')
    setOutcome('')
    setNote('')
    setError('')
    setOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!reason || !outcome || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await apiRequest<{ success: boolean; data: { contact: Contact } }>(contactsPath(subscriptionId), {
        token,
        method: 'POST',
        body: { reason, outcome, note: note.trim() || undefined },
      })
      setLatest(response.data.contact)
      setOpen(false)
      onSaved?.(response.data.contact)
    } catch (requestError) {
      setError(contactErrorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  if (!canWrite && !(showLast && shown)) return null
  const formId = `customer-contact-${subscriptionId}`

  return (
    <div className="contact-inline">
      {showLast && shown ? <span className="muted">{lastContactText(shown)}</span> : null}
      {canWrite ? (
        <button type="button" className="ghost-button" onClick={start}>Registrar contato</button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar contato"
        description={`${name} · WhatsApp`}
        footer={<button type="submit" form={formId} className="primary-button" disabled={saving || !reason || !outcome}>Salvar contato</button>}
      >
        {error ? <div className="alert" role="alert">{error}</div> : null}
        <div className="contact-phone">
          {phone ? (
            <>
              <span>Telefone: <strong>{phone}</strong></span>
              <CopyButton value={phone} label="Copiar telefone" />
            </>
          ) : <span className="muted">Sem telefone</span>}
        </div>
        <form id={formId} className="stack contact-form" onSubmit={(event) => void submit(event)}>
          <label>
            Motivo
            <select value={reason} required onChange={(event) => setReason(event.target.value as ContactReason)}>
              <option value="">Escolha</option>
              {CONTACT_REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <fieldset className="radio-group">
            <legend>Resultado</legend>
            {CONTACT_OUTCOMES.map((option) => (
              <label key={option.value} className="radio-line">
                <input type="radio" name={`${formId}-outcome`} value={option.value} checked={outcome === option.value} onChange={() => setOutcome(option.value)} />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label>
            Nota (opcional)
            <textarea value={note} maxLength={CONTACT_NOTE_MAX} onChange={(event) => setNote(event.target.value)} />
          </label>
        </form>
      </Dialog>
    </div>
  )
}
