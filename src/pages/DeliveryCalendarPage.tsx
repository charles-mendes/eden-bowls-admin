import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { FiltersBar } from '../components/FiltersBar'
import { Dialog } from '../components/Dialog'
import { MarketSelect } from '../components/MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError } from '../lib/api'
import { formatDate } from '../lib/format'
import { defaultMarket, hasBothMarkets, type MarketCode } from '../lib/markets'
import {
  createClosedDay,
  getCalendarAlerts,
  listCalendarHistory,
  listCalendarSyncs,
  listClosedDays,
  previewClosedDayChange,
  previewNewClosedDay,
  removeClosedDay,
  resendCalendarSync,
  updateClosedDay,
  type AffectedDelivery,
  type CalendarAlerts,
  type CalendarHistoryItem,
  type CalendarPreview,
  type CalendarSync,
  type CalendarSyncs,
  type ClosedDay,
  type ClosedDayChange,
  type ClosedDayFlags,
  type ClosedDayType,
  type NewClosedDay,
} from '../lib/deliveryCalendar'

const TIME_ZONES: Record<MarketCode, string> = { BR: 'America/Sao_Paulo', US: 'America/New_York' }

const TYPE_LABELS: Record<ClosedDayType, string> = {
  national: 'Nacional',
  regional: 'Regional',
  carrier: 'Transportadora (UPS)',
  adhoc: 'Pontual',
}

const FLAG_LABELS: Record<keyof ClosedDayFlags, string> = {
  closesPreparation: 'Preparo',
  closesPickup: 'Coleta',
  closesDelivery: 'Entrega',
}

const FLAG_HINTS: Record<keyof ClosedDayFlags, string> = {
  closesPreparation: 'Cozinha não produz',
  closesPickup: 'Transportadora não coleta',
  closesDelivery: 'Não há entrega ao cliente',
}

const FLAGS = Object.keys(FLAG_LABELS) as Array<keyof ClosedDayFlags>

const MOVE_LABELS: Record<AffectedDelivery['move'], string> = {
  stripe_sync: 'Cobrança movida no Stripe',
  pending_change: 'Mudança pendente remarcada',
  projection_only: 'Só o dia de preparo muda',
}

const LOCK_LABELS: Record<string, string> = {
  in_production: 'em produção',
  ready: 'pronta',
  blocked: 'bloqueada',
  paid: 'já paga',
  past_editable_until: 'fora do prazo de edição',
  no_preparation_day: 'sem dia de preparo disponível',
}

const ACTION_LABELS: Record<string, string> = {
  'delivery_calendar.create': 'Inclusão',
  'delivery_calendar.remove': 'Remoção',
  'delivery_calendar.activate': 'Reativação',
  'delivery_calendar.deactivate': 'Desativação',
  'delivery_calendar.update': 'Mudança de marcação',
  'delivery_calendar.sync_resend': 'Reenvio ao Stripe',
}

const SYNC_STATUS_LABELS: Record<string, string> = {
  pending: 'Atrasada',
  failed: 'Falhou',
  conflict: 'Conflito',
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function formatDay(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${weekday})`
}

function closedFlags(values: Partial<ClosedDayFlags> | null | undefined) {
  if (!values) return '—'
  const closed = FLAGS.filter((flag) => values[flag]).map((flag) => FLAG_LABELS[flag])
  return closed.length ? closed.join(', ') : 'nenhuma'
}

function describeValues(values: (Partial<ClosedDayFlags> & { active?: boolean }) | null | undefined) {
  if (!values) return '—'
  return `${values.active === false ? 'Inativa' : 'Ativa'} · fecha ${closedFlags(values)}`
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

type LockedSubscription = { stripeSubscriptionId: string; deliveryId?: string; lockReason?: string | null }

function lockedFrom(error: unknown): LockedSubscription[] {
  if (!(error instanceof ApiRequestError) || error.code !== 'delivery_locked') return []
  const list = error.details?.subscriptions
  return Array.isArray(list) ? list as LockedSubscription[] : []
}

type Draft = NewClosedDay

const EMPTY_DRAFT: Draft = {
  type: 'adhoc',
  closedOn: '',
  label: '',
  closesPreparation: true,
  closesPickup: true,
  closesDelivery: true,
}

// A pending write: a new row, a flag change, or a reactivation. It is previewed before it is saved.
type PendingWrite =
  | { kind: 'create'; draft: Draft }
  | { kind: 'change'; row: ClosedDay; change: ClosedDayChange }

function AffectedList({ affected, timeZone }: { affected: AffectedDelivery[]; timeZone: string }) {
  if (affected.length === 0) {
    return <p>Nenhuma entrega é afetada por esta mudança.</p>
  }
  return (
    <div className="table-shell table-scroll">
      <table>
        <thead>
          <tr>
            <th>Assinatura</th>
            <th>Preparo hoje</th>
            <th>Novo preparo</th>
            <th>Como muda</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {affected.map((item) => (
            <tr key={`${item.stripeSubscriptionId}-${item.deliveryId}`}>
              <td>{item.stripeSubscriptionId}</td>
              <td>{formatDay(item.preparationDay)}</td>
              <td>{formatDay(item.newPreparationDay)}</td>
              <td>
                {MOVE_LABELS[item.move]}
                {item.pendingTrialEnd ? (
                  <div className="muted">
                    {formatDate(item.pendingTrialEnd.previous, timeZone)} → {formatDate(item.pendingTrialEnd.next, timeZone)}
                  </div>
                ) : null}
              </td>
              <td>
                {item.locked
                  ? <span className="badge-error">Travada ({LOCK_LABELS[item.lockReason || ''] || item.lockReason})</span>
                  : <span className="badge-success">Editável</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FlagCheckboxes({ values, onChange }: { values: ClosedDayFlags; onChange: (flag: keyof ClosedDayFlags, value: boolean) => void }) {
  return (
    <fieldset className="closure-flags">
      <legend>O que fecha neste dia</legend>
      <div className="closure-flag-grid">
        {FLAGS.map((flag) => (
          <label key={flag} className={values[flag] ? 'closure-flag is-checked' : 'closure-flag'}>
            <input
              type="checkbox"
              checked={values[flag]}
              aria-labelledby={`closure-flag-${flag}-label`}
              aria-describedby={`closure-flag-${flag}-hint`}
              onChange={(event) => onChange(flag, event.target.checked)}
            />
            <span className="closure-flag-text">
              <strong id={`closure-flag-${flag}-label`}>{FLAG_LABELS[flag]}</strong>
              <span id={`closure-flag-${flag}-hint`}>{FLAG_HINTS[flag]}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="field-hint">Marque pelo menos uma opção.</p>
    </fieldset>
  )
}

export function DeliveryCalendarPage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('production.write')
  const bothMarkets = hasBothMarkets(user)
  const currentYear = new Date().getFullYear()
  const [pickedMarket, setPickedMarket] = useState<MarketCode | ''>('')
  const market: MarketCode | null = bothMarkets ? (pickedMarket || 'BR') : defaultMarket(user)
  const timeZone = market ? TIME_ZONES[market] : 'UTC'
  const [year, setYear] = useState(currentYear)
  const [rows, setRows] = useState<ClosedDay[]>([])
  const [history, setHistory] = useState<CalendarHistoryItem[]>([])
  const [syncs, setSyncs] = useState<CalendarSyncs | null>(null)
  const [alerts, setAlerts] = useState<CalendarAlerts | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<ClosedDay | null>(null)
  const [editFlags, setEditFlags] = useState<ClosedDayFlags | null>(null)
  const [pending, setPending] = useState<PendingWrite | null>(null)
  const [preview, setPreview] = useState<CalendarPreview | null>(null)
  const [locked, setLocked] = useState<LockedSubscription[]>([])
  const [dialogError, setDialogError] = useState('')
  const [removing, setRemoving] = useState<ClosedDay | null>(null)
  const [resending, setResending] = useState<CalendarSync | null>(null)
  const [busy, setBusy] = useState(false)

  const requestKey = `${market}-${year}-${reloadKey}`
  const loading = loadedKey !== requestKey
  const load = () => setReloadKey((key) => key + 1)

  useEffect(() => {
    if (!token || !market) return undefined
    let cancelled = false
    void (async () => {
      try {
        const [list, events, syncList, alertList] = await Promise.all([
          listClosedDays(token, market, year),
          listCalendarHistory(token, market, year),
          listCalendarSyncs(token, market),
          getCalendarAlerts(token, market),
        ])
        if (cancelled) return
        setRows(list?.items ?? [])
        setHistory(events?.items ?? [])
        setSyncs(syncList)
        setAlerts(alertList)
        setError('')
      } catch (requestError) {
        if (cancelled) return
        setError(errorMessage(requestError, 'Falha ao carregar feriados e fechamentos.'))
        setRows([])
      } finally {
        if (!cancelled) setLoadedKey(requestKey)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, market, year, requestKey])

  const closeWriteDialogs = () => {
    setDraft(null)
    setEditing(null)
    setEditFlags(null)
    setPending(null)
    setPreview(null)
    setLocked([])
    setDialogError('')
  }

  const askPreview = async (write: PendingWrite) => {
    if (!token || !market) return
    setBusy(true)
    setDialogError('')
    setLocked([])
    try {
      const result = write.kind === 'create'
        ? await previewNewClosedDay(token, market, write.draft)
        : await previewClosedDayChange(token, market, write.row.id, write.change)
      setPending(write)
      setPreview(result)
    } catch (requestError) {
      setDialogError(errorMessage(requestError, 'Falha ao calcular as entregas afetadas.'))
    } finally {
      setBusy(false)
    }
  }

  const confirmWrite = async () => {
    if (!token || !market || !pending) return
    setBusy(true)
    setDialogError('')
    try {
      const result = pending.kind === 'create'
        ? await createClosedDay(token, market, pending.draft)
        : await updateClosedDay(token, market, pending.row.id, pending.change)
      const moved = result?.affected?.length ?? 0
      setNotice(moved > 0 ? `Calendário salvo. ${moved} entrega(s) remarcada(s).` : 'Calendário salvo.')
      closeWriteDialogs()
      load()
    } catch (requestError) {
      const lockedList = lockedFrom(requestError)
      setLocked(lockedList)
      setDialogError(errorMessage(requestError, 'Falha ao salvar o calendário.'))
    } finally {
      setBusy(false)
    }
  }

  const submitDraft = (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    if (!draft.closedOn || !draft.label.trim()) {
      setDialogError('Informe a data e o rótulo.')
      return
    }
    if (!FLAGS.some((flag) => draft[flag])) {
      setDialogError('Marque ao menos preparo, coleta ou entrega.')
      return
    }
    void askPreview({ kind: 'create', draft: { ...draft, label: draft.label.trim() } })
  }

  const submitEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !editFlags) return
    if (!FLAGS.some((flag) => editFlags[flag])) {
      setDialogError('Marque ao menos uma marcação. Para abrir o dia, desative a linha.')
      return
    }
    const change: ClosedDayChange = Object.fromEntries(FLAGS.filter((flag) => editFlags[flag] !== editing[flag]).map((flag) => [flag, editFlags[flag]]))
    if (Object.keys(change).length === 0) {
      closeWriteDialogs()
      return
    }
    void askPreview({ kind: 'change', row: editing, change })
  }

  const deactivate = async (row: ClosedDay) => {
    if (!token || !market) return
    setBusy(true)
    setError('')
    try {
      await updateClosedDay(token, market, row.id, { active: false })
      setNotice(`${row.label} desativado. A data abre para novas projeções; entregas já remarcadas ficam como estão.`)
      load()
    } catch (requestError) {
      setError(errorMessage(requestError, 'Falha ao desativar.'))
    } finally {
      setBusy(false)
    }
  }

  const confirmRemove = async () => {
    if (!token || !market || !removing) return
    setBusy(true)
    setError('')
    try {
      await removeClosedDay(token, market, removing.id)
      setNotice(`${removing.label} removido.`)
      setRemoving(null)
      load()
    } catch (requestError) {
      setError(errorMessage(requestError, 'Falha ao remover.'))
      setRemoving(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmResend = async () => {
    if (!token || !market || !resending) return
    setBusy(true)
    setDialogError('')
    try {
      await resendCalendarSync(token, market, resending)
      setNotice(`Sincronização de ${resending.stripeSubscriptionId} reenviada.`)
      setResending(null)
      load()
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'sync_conflict_changed') {
        const found = requestError.details?.foundTrialEnd
        setResending({ ...resending, foundTrialEnd: typeof found === 'string' ? found : null })
        setDialogError('O valor no Stripe mudou desde que você abriu esta tela. Confira o novo valor antes de reenviar.')
      } else {
        setDialogError(errorMessage(requestError, 'Falha ao reenviar.'))
      }
      load()
    } finally {
      setBusy(false)
    }
  }

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
  const writeOpen = Boolean(draft || editing || pending)
  const writeTitle = pending
    ? 'Confirmar mudança'
    : draft ? 'Novo fechamento' : 'Editar marcações'
  const ups = alerts?.upsCalendar

  return (
    <PageFrame
      title="Feriados e fechamentos"
      description="Dias fechados para preparo, coleta e entrega de cada mercado."
      actions={canWrite && market ? (
        <button className="primary-button" type="button" onClick={() => { setDraft({ ...EMPTY_DRAFT, closedOn: `${year}-01-01` }); setDialogError('') }}>
          Novo fechamento
        </button>
      ) : null}
    >
      <Section title="Filtros">
        <FiltersBar>
          <MarketSelect user={user} value={market || ''} onChange={(value) => setPickedMarket(value as MarketCode)} />
          <label>
            Ano
            <select aria-label="Ano" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </FiltersBar>
      </Section>

      {error ? <div className="alert" role="alert">{error}</div> : null}
      {notice ? <div className="warning" role="status">{notice}</div> : null}

      {ups && ups.warn ? (
        <div className="warning" role="alert" aria-label="Calendário UPS">
          {ups.coveredThrough
            ? `O calendário UPS de ${ups.missingYear} ainda não foi cadastrado. A cobertura termina em ${formatDay(ups.coveredThrough)} (${ups.daysLeft} dias).`
            : `Nenhum ano do calendário UPS está cadastrado. Cadastre o calendário de ${ups.missingYear}.`}
        </div>
      ) : null}

      {syncs && (syncs.delayed.length > 0 || syncs.problems.length > 0) ? (
        <Section title="Sincronizações com o Stripe" description={`Atrasadas há mais de ${syncs.delayMinutes} minutos, com falha ou em conflito.`}>
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Assinatura</th>
                  <th>Situação</th>
                  <th>Data esperada</th>
                  <th>Data alvo</th>
                  <th>Encontrada no Stripe</th>
                  <th>Tentativas</th>
                  <th>Último erro</th>
                  {canWrite ? <th>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {[...syncs.delayed, ...syncs.problems].map((sync) => (
                  <tr key={sync.id}>
                    <td>{sync.stripeSubscriptionId}</td>
                    <td><span className={sync.status === 'pending' ? 'badge-warning' : 'badge-error'}>{SYNC_STATUS_LABELS[sync.status] || sync.status}</span></td>
                    <td>{formatDate(sync.expectedTrialEnd, timeZone)}</td>
                    <td>{formatDate(sync.targetTrialEnd, timeZone)}</td>
                    <td>{sync.status === 'conflict' ? (sync.foundTrialEnd ? formatDate(sync.foundTrialEnd, timeZone) : 'sem trial (cobrança já feita)') : '—'}</td>
                    <td>{sync.attempts}</td>
                    <td>{sync.lastError || '—'}</td>
                    {canWrite ? (
                      <td>
                        {sync.status === 'failed' || sync.status === 'conflict' ? (
                          <button className="ghost-button" type="button" onClick={() => { setResending(sync); setDialogError('') }}>
                            Reenviar
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section title="Dias fechados" description={market ? `${market} · ${year}` : undefined}>
        {loading ? <p aria-busy="true">Carregando calendário…</p> : rows.length === 0 ? (
          <p>Nenhum dia fechado cadastrado para este ano.</p>
        ) : (
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Rótulo</th>
                  <th>Tipo</th>
                  <th>Situação</th>
                  {FLAGS.map((flag) => <th key={flag}>{FLAG_LABELS[flag]}</th>)}
                  {canWrite ? <th>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.active ? undefined : 'muted'}>
                    <td>{formatDay(row.closedOn)}</td>
                    <td>{row.label}</td>
                    <td>{TYPE_LABELS[row.type] || row.type}</td>
                    <td>{row.active ? <span className="badge-success">Ativa</span> : <span className="badge-info">Inativa</span>}</td>
                    {FLAGS.map((flag) => <td key={flag}>{row[flag] ? 'Fechado' : 'Aberto'}</td>)}
                    {canWrite ? (
                      <td>
                        <div className="table-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            aria-label={`Editar marcações de ${row.label}`}
                            onClick={() => { setEditing(row); setEditFlags({ closesPreparation: row.closesPreparation, closesPickup: row.closesPickup, closesDelivery: row.closesDelivery }); setDialogError('') }}
                          >
                            Editar
                          </button>
                          {row.active ? (
                            <button className="ghost-button" type="button" disabled={busy} aria-label={`Desativar ${row.label}`} onClick={() => void deactivate(row)}>
                              Desativar
                            </button>
                          ) : (
                            <button
                              className="ghost-button"
                              type="button"
                              disabled={busy}
                              aria-label={`Reativar ${row.label}`}
                              onClick={() => void askPreview({ kind: 'change', row, change: { active: true } })}
                            >
                              Reativar
                            </button>
                          )}
                          {row.type === 'regional' || row.type === 'adhoc' ? (
                            <button className="danger-button" type="button" aria-label={`Remover ${row.label}`} onClick={() => setRemoving(row)}>
                              Remover
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Histórico" description="Quem mudou o calendário deste mercado e ano, do mais recente ao mais antigo.">
        {history.length === 0 ? <p>Nenhuma mudança registrada neste ano.</p> : (
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Data</th>
                  <th>Antes</th>
                  <th>Depois</th>
                  <th>Assinaturas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const meta = item.metadata
                  const resend = item.action === 'delivery_calendar.sync_resend'
                  return (
                    <tr key={item.id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.actorEmail || '—'}</td>
                      <td>{ACTION_LABELS[item.action] || item.action}</td>
                      <td>{formatDay(meta.closedOn)}{meta.label ? <div className="muted">{meta.label}</div> : null}</td>
                      <td>{resend ? `Esperada ${formatDate(meta.expectedTrialEnd, timeZone)} · encontrada ${formatDate(meta.foundTrialEnd, timeZone)}` : describeValues(meta.before)}</td>
                      <td>{resend ? `Alvo ${formatDate(meta.targetTrialEnd, timeZone)}` : describeValues(meta.after)}</td>
                      <td>
                        {resend ? meta.stripeSubscriptionId : (meta.moved && meta.moved.length > 0 ? (
                          <ul className="plain-list">
                            {meta.moved.map((moved) => (
                              <li key={`${moved.stripeSubscriptionId}-${moved.deliveryId}`}>
                                {moved.stripeSubscriptionId}: {formatDay(moved.previousPreparationDay)} → {formatDay(moved.newPreparationDay)} · {MOVE_LABELS[moved.move]}
                                {moved.pendingTrialEnd ? ` (${formatDate(moved.pendingTrialEnd.previous, timeZone)} → ${formatDate(moved.pendingTrialEnd.next, timeZone)})` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Dialog
        title={writeTitle}
        description={pending ? 'Confira as entregas afetadas antes de salvar.' : undefined}
        open={writeOpen}
        onClose={closeWriteDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeWriteDialogs}>Cancelar</button>
            {pending ? (
              <button
                className="primary-button"
                type="button"
                disabled={busy || Boolean(preview?.affected.some((item) => item.locked))}
                onClick={() => void confirmWrite()}
              >
                Salvar
              </button>
            ) : (
              <button className="primary-button" type="submit" form="delivery-calendar-form" disabled={busy}>
                Ver entregas afetadas
              </button>
            )}
          </>
        )}
      >
        {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
        {locked.length > 0 ? (
          <ul className="plain-list" aria-label="Entregas travadas">
            {locked.map((item) => (
              <li key={`${item.stripeSubscriptionId}-${item.deliveryId}`}>
                {item.stripeSubscriptionId}: {LOCK_LABELS[item.lockReason || ''] || item.lockReason}
              </li>
            ))}
          </ul>
        ) : null}
        {pending && preview ? (
          <>
            {preview.shortNotice ? (
              <div className="warning" role="alert">Esta data está a menos de 7 dias. O fechamento pode ser salvo, mas avise a operação.</div>
            ) : null}
            {preview.affected.some((item) => item.locked) ? (
              <div className="alert">Há entregas travadas nesta data. Resolva-as antes de fechar o dia.</div>
            ) : null}
            <AffectedList affected={preview.affected} timeZone={timeZone} />
          </>
        ) : draft ? (
          <form id="delivery-calendar-form" className="closure-form" onSubmit={submitDraft}>
            {market ? <p className="closure-context">Mercado <strong>{market}</strong></p> : null}
            <div className="closure-row">
              <label className="closure-field">
                Tipo
                <select aria-label="Tipo" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Draft['type'] })}>
                  <option value="adhoc">Pontual</option>
                  <option value="regional">Regional</option>
                  {market === 'US' ? <option value="carrier">Transportadora (UPS)</option> : null}
                </select>
              </label>
              <label className="closure-field">
                Data
                <input aria-label="Data" type="date" value={draft.closedOn} onChange={(event) => setDraft({ ...draft, closedOn: event.target.value })} />
              </label>
            </div>
            <label className="closure-field">
              Rótulo
              <input
                aria-label="Rótulo"
                maxLength={191}
                placeholder="Ex.: Carnaval, Inventário"
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              />
            </label>
            <FlagCheckboxes values={draft} onChange={(flag, value) => setDraft({ ...draft, [flag]: value })} />
          </form>
        ) : editing && editFlags ? (
          <form id="delivery-calendar-form" className="closure-form" onSubmit={submitEdit}>
            <p className="closure-context"><strong>{editing.label}</strong> · {formatDay(editing.closedOn)}</p>
            <FlagCheckboxes values={editFlags} onChange={(flag, value) => setEditFlags({ ...editFlags, [flag]: value })} />
          </form>
        ) : null}
      </Dialog>

      <Dialog
        title="Remover fechamento"
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setRemoving(null)}>Cancelar</button>
            <button className="danger-button" type="button" disabled={busy} onClick={() => void confirmRemove()}>Remover</button>
          </>
        )}
      >
        <p>
          Remover {removing?.label} de {formatDay(removing?.closedOn)}? A data abre para novas projeções.
          Entregas já remarcadas e cobranças já movidas ficam como estão.
        </p>
      </Dialog>

      <Dialog
        title="Reenviar ao Stripe"
        open={Boolean(resending)}
        onClose={() => { setResending(null); setDialogError('') }}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => { setResending(null); setDialogError('') }}>Cancelar</button>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void confirmResend()}>Reenviar</button>
          </>
        )}
      >
        {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
        {resending?.status === 'conflict' ? (
          <>
            <dl>
              <dt>Encontrada no Stripe</dt>
              <dd>{resending.foundTrialEnd ? formatDate(resending.foundTrialEnd, timeZone) : 'sem trial (cobrança já feita)'}</dd>
              <dt>Data alvo</dt>
              <dd>{formatDate(resending.targetTrialEnd, timeZone)}</dd>
            </dl>
            <div className="warning">
              Reenviar substitui o valor que está no Stripe pela data alvo. Se o cliente pulou ou adiou essa entrega, o pedido dele é desfeito.
            </div>
          </>
        ) : resending ? (
          <p>A sincronização de {resending.stripeSubscriptionId} volta para a fila e será aplicada para {formatDate(resending.targetTrialEnd, timeZone)}.</p>
        ) : null}
      </Dialog>
    </PageFrame>
  )
}
