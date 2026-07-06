import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="screen-center">
      <div className="login-card">
        <p className="eyebrow">404</p>
        <h1>Rota não encontrada</h1>
        <p className="muted">A página solicitada não existe neste painel.</p>
        <Link className="primary-button inline-block" to="/dashboard">
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
