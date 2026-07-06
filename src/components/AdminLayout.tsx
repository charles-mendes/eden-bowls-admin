import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { adminMenu } from '../lib/menu'
import { useAuth } from '../contexts/AuthContext'

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const visibleMenu = adminMenu.filter((item) => {
    if (!item.roles) return true
    if (!user) return false
    return item.roles.some((role) => user.roles.includes(role))
  })

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark">EB</div>
          <div className="brand-copy">
            <strong>Eden Bowls Admin</strong>
            <span>Painel operacional</span>
          </div>
        </div>

        <nav className="menu">
          {visibleMenu.map((item) => (
            <NavLink key={item.href} to={item.href} className={({ isActive }) => (isActive ? 'menu-link active' : 'menu-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Administração</p>
            <h1>Painel operacional</h1>
          </div>
          <div className="topbar-actions">
            <div className="user-chip">
              <span>{user?.email ?? 'sem usuário'}</span>
              <small>{user?.roles.join(' · ') ?? 'desconhecido'}</small>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              Sair
            </button>
          </div>
        </header>

        <section className="content-area">{children}</section>
      </main>
    </div>
  )
}
