import type { SectionFeedback } from '../lib/useSectionFeedback'

export function SectionFeedbackView({ feedback }: { feedback: SectionFeedback }) {
  if (!feedback.message && !feedback.error) return null
  return (
    <>
      {feedback.error ? (
        <div className="alert section-feedback" role="alert">
          <span>{feedback.error}</span>
          <button className="link-button" type="button" onClick={feedback.dismiss}>Fechar</button>
        </div>
      ) : null}
      {feedback.message ? <div className="success section-feedback" role="status">{feedback.message}</div> : null}
    </>
  )
}
