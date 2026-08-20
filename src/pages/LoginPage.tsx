import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
    const destination = user.roles.includes('nutritionist') && !user.roles.includes('admin') && !user.roles.includes('operator')
      ? '/nutrition/simulate'
      : from
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const me = await login(email, password)
      const destination = me.roles.includes('nutritionist') && !me.roles.includes('admin') && !me.roles.includes('operator')
        ? '/nutrition/simulate'
        : from === '/nutrition/simulate' || from === '/login' ? '/dashboard' : from
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <p className="eyebrow">Eden Bowls Admin</p>
        <h1>Acesso administrativo</h1>
        <p className="muted">Entre com um usuário admin, operator, nutricionista ou readonly.</p>

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="admin@edenbowls.com" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" required />
          </label>

          {error ? <div className="alert">{error}</div> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
