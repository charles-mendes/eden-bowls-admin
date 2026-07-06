export function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="pager">
      <button type="button" className="ghost-button" onClick={onPrev} disabled={page <= 1}>
        Anterior
      </button>
      <span>
        Página {page} de {Math.max(totalPages, 1)}
      </span>
      <button type="button" className="ghost-button" onClick={onNext} disabled={page >= totalPages}>
        Próxima
      </button>
    </div>
  )
}