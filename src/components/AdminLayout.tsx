import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { groupedMenuItems } from '../lib/menu'
import { useAuth } from '../contexts/AuthContext'

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const menuGroups = groupedMenuItems(user?.roles ?? [])

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">EB</div>
          <div className="brand-copy">
            <strong>Eden Bowls</strong>
            <span>Admin</span>
          </div>
        </div>

        <nav className="menu" aria-label="Seções do painel">
          {menuGroups.map((group) => (
            <div className="menu-group" key={group.group}>
              <p className="menu-group-label">{group.group}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) => (isActive ? 'menu-link active' : 'menu-link')}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <h1>Painel administrativo</h1>
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
