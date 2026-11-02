import { useState, type FormEvent } from 'react'
import { Dialog } from './Dialog'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import type { NfeDetail } from '../lib/nfe'

type Form = {
  name: string
  email: string
  document: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zipcode: string
}

const FIELDS: { key: keyof Form; label: string; optional?: boolean; maxLength?: number }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'document', label: 'CPF' },
  { key: 'street', label: 'Rua' },
  { key: 'number', label: 'Número' },
  { key: 'complement', label: 'Complemento', optional: true },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF', maxLength: 2 },
  { key: 'zipcode', label: 'CEP', maxLength: 9 },
]

function formFrom(item: NfeDetail): Form {
  const address = item.customer_address ?? {}
  return {
    name: item.customer_name ?? '',
    email: item.customer_email ?? '',
    document: item.customer_document ?? '',
    street: address.street ?? '',
    number: address.number ?? '',
    complement: address.complement ?? '',
    neighborhood: address.neighborhood ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zipcode: address.zipcode ?? '',
  }
}

export function NfeCustomerDialog({ item, onClose, onSaved }: {
  item: NfeDetail
  onClose: () => void
  onSaved: (next: NfeDetail) => void
}) {
  const { token } = useAuth()
  const [form, setForm] = useState(() => formFrom(item))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token) return
    try {
      setSaving(true)
      setError('')
      const { name, email, document, ...address } = form
      const response = await apiRequest<{ success: boolean; data: NfeDetail }>(`/admin/nfe/${item.id}/customer`, {
        token,
        method: 'PATCH',
        body: { name, email, document, address },
      })
      onSaved(response.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar os dados')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Corrigir dados do cliente"
      description="Os dados entram nesta nota na próxima tentativa e também atualizam o contato no Bling."
      onClose={onClose}
      footer={(
        <>
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      <form className="nfe-customer-form" onSubmit={(event) => void save(event)}>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {FIELDS.map((field) => (
          <label key={field.key} className={field.key === 'name' || field.key === 'street' ? 'nfe-field-wide' : undefined}>
            {field.label}{field.optional ? ' (opcional)' : ''}
            <input
              value={form[field.key]}
              maxLength={field.maxLength}
              required={!field.optional}
              onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
        <button className="visually-hidden" type="submit" tabIndex={-1} aria-hidden="true">Salvar</button>
      </form>
    </Dialog>
  )
}
