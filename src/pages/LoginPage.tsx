import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPostLoginPath } from '../lib/roles'

export function LoginPage() {
  const { token, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  if (token && user) {
    return <Navigate to={getPostLoginPath(user.roles, from)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const me = await login(email, password)
      navigate(getPostLoginPath(me.roles, from), { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-card">
          <p className="eyebrow">Eden Bowls</p>
          <h1>Entrar no painel</h1>
          <p className="muted">Use uma conta admin, operator, nutricionista ou somente leitura.</p>

          <form className="stack" onSubmit={handleSubmit}>
            <label>
              E-mail
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="username"
                placeholder="ops@edenbowls.com"
                required
              />
            </label>
            <label>
              Senha
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </label>

            {error ? <div className="alert">{error}</div> : null}

            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
