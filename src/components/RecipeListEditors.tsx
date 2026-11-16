import { useState } from 'react'
import { listToParagraphs, paragraphsToList, splitPastedList } from '../lib/recipeContent'

// One textarea for a list of sentences. The text typed is kept as is (blank lines included) and is
// replaced only when the list changes from outside, such as a label loaded after the page.
export function ParagraphsEditor({ label, values, disabled, onChange }: {
  label: string
  values: string[]
  disabled: boolean
  onChange: (values: string[]) => void
}) {
  const [text, setText] = useState(() => listToParagraphs(values))
  const parsed = paragraphsToList(text)
  if (parsed.join('\u0000') !== values.join('\u0000')) {
    setText(listToParagraphs(values))
  }
  const count = parsed.length

  return (
    <label className="label-paragraphs">
      <span className="label-paragraphs-title">{label}</span>
      <textarea
        aria-label={label}
        aria-describedby={`paragraphs-${label}-hint`}
        rows={Math.max(4, text.split('\n').length + 1)}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value)
          onChange(paragraphsToList(event.target.value))
        }}
      />
      <span id={`paragraphs-${label}-hint`} className="field-hint">
        Um parágrafo por item, separados por uma linha em branco. {count === 1 ? '1 item' : `${count} itens`}.
      </span>
    </label>
  )
}

export function ListEditor({ label, item, values, disabled, pasteable = false, onChange }: {
  label: string
  item: string
  values: string[]
  disabled: boolean
  pasteable?: boolean
  onChange: (values: string[]) => void
}) {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const pasted = splitPastedList(pasteText)
  const addPasted = () => {
    onChange([...values.filter((value) => value.trim()), ...pasted])
    setPasteText('')
    setPasteOpen(false)
  }

  return (
    <fieldset className="label-list">
      <legend>{label}</legend>
      {values.length === 0 ? <p className="field-hint">Nenhum item.</p> : null}
      {values.map((value, index) => (
        <div className="label-list-row" key={index}>
          <input
            aria-label={`${item} ${index + 1}`}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(values.map((current, at) => (at === index ? event.target.value : current)))}
          />
          {!disabled ? (
            <button
              className="ghost-button"
              type="button"
              aria-label={`Remover ${item.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(values.filter((_, at) => at !== index))}
            >
              Remover
            </button>
          ) : null}
        </div>
      ))}
      {!disabled && pasteable && pasteOpen ? (
        <div className="label-paste">
          <textarea
            aria-label={`Colar lista de ${label.toLowerCase()}`}
            aria-describedby={`paste-${item}-hint`}
            rows={3}
            value={pasteText}
            placeholder="Arroz integral, Carne bovina, Lentilha, Abobrinha…"
            onChange={(event) => setPasteText(event.target.value)}
          />
          <span id={`paste-${item}-hint`} className="field-hint">
            Separe por vírgula, ponto e vírgula ou uma por linha. {pasted.length === 1 ? '1 item' : `${pasted.length} itens`} a adicionar.
          </span>
          <div className="inline-actions">
            <button className="primary-button" type="button" disabled={pasted.length === 0} onClick={addPasted}>
              Adicionar à lista
            </button>
            <button className="ghost-button" type="button" onClick={() => { setPasteText(''); setPasteOpen(false) }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {!disabled ? (
        <div className="inline-actions">
          <button className="link-button" type="button" onClick={() => onChange([...values, ''])}>
            Adicionar {item.toLowerCase()}
          </button>
          {pasteable && !pasteOpen ? (
            <button className="link-button" type="button" onClick={() => setPasteOpen(true)}>
              Colar lista
            </button>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}
