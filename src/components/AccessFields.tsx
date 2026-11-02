import type { Dispatch, SetStateAction } from 'react'
import { ROLE_HINTS, panelRoleOf, type AccessAccount, type AccessForm } from '../lib/accessForm'
import { MARKET_LABELS, staffMarketRequired } from '../lib/markets'
import { PANEL_ROLE_OPTIONS, roleLabel } from '../lib/roles'

/** The same fields create an access in the list and edit it on the customer page. */
export function AccessFields({ form, setForm, account }: {
  form: AccessForm
  setForm: Dispatch<SetStateAction<AccessForm>>
  account: AccessAccount | null
}) {
  const locked = Boolean(account?.lockedByAllowlist)
  const role = locked ? 'admin' : form.role
  const isStaff = Boolean(account && panelRoleOf(account))

  return (
    <>
      <fieldset className="access-group">
        <legend>Dados da conta</legend>
        <div className="access-fields">
          <label>
            Nome
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label>
            <span>Telefone <span className="access-optional">opcional</span></span>
            <input type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label className="access-field-wide">
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              disabled={Boolean(account)}
              required={!account}
            />
            {account ? <small className="access-hint">O e-mail não muda depois da criação.</small> : null}
          </label>
        </div>
      </fieldset>

      <fieldset className="access-group">
        <legend>Acesso ao painel</legend>
        <div className="access-fields">
          <label>
            Papel
            <select
              value={role}
              onChange={(event) => setForm((current) => ({
                ...current,
                role: event.target.value,
                market: event.target.value === 'admin' ? '' : current.market,
              }))}
              disabled={locked}
              required={!account}
            >
              {!isStaff ? <option value="">{account ? 'Sem papel' : 'Selecione um papel'}</option> : null}
              {PANEL_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {role && staffMarketRequired(role) ? (
            <label>
              Mercado
              <select
                value={form.market}
                onChange={(event) => setForm((current) => ({ ...current, market: event.target.value === 'US' ? 'US' : event.target.value === 'BR' ? 'BR' : '' }))}
                disabled={locked}
                required
              >
                <option value="">Selecione</option>
                <option value="BR">{MARKET_LABELS.BR}</option>
                <option value="US">{MARKET_LABELS.US}</option>
              </select>
            </label>
          ) : null}
        </div>
        <p className="access-hint">
          {role
            ? ROLE_HINTS[role]
            : account ? 'Sem papel, a conta continua só com acesso à loja.' : 'Escolha o que esta pessoa poderá fazer no painel.'}
        </p>
        {account && !isStaff && role ? (
          <div className="warning">Ao salvar, {account.email} passa a entrar no painel como {roleLabel(role)}.</div>
        ) : null}
      </fieldset>

      {locked ? (
        <div className="warning">
          Este e-mail está em ADMIN_EMAILS. O papel efetivo permanece Admin e não pode ser rebaixado pela UI.
        </div>
      ) : null}
    </>
  )
}
