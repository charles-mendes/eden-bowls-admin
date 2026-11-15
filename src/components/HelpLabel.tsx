import type { ReactNode } from 'react'
import { helpText } from './HelpText'
import { InfoHint } from './InfoHint'

// The label of a field with its "i": the label stays tied to the control, the tip is the control's description.
export function HelpLabel({ htmlFor, label, help }: { htmlFor: string; label: ReactNode; help?: readonly string[] }) {
  return (
    <span className="field-label-row">
      <label htmlFor={htmlFor}>{label}</label>
      {help ? <InfoHint id={`${htmlFor}-help`} topic={typeof label === 'string' ? label.toLowerCase() : 'este campo'} text={helpText(help)} wide /> : null}
    </span>
  )
}
