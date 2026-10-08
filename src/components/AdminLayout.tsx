import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { activeMenuHref, groupedMenuItems } from '../lib/menu'
import { useAuth } from '../contexts/AuthContext'

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const forcePassword = Boolean(user?.mustChangePassword)
  const menuGroups = groupedMenuItems(forcePassword ? [] : user?.roles ?? [])
  // Only the most specific item is active: /billing/coupons lights Cupons, not Assinantes too.
  const activeHref = activeMenuHref(location.pathname, menuGroups.flatMap((group) => group.items))

  return (
    <div className={menuOpen ? 'admin-shell menu-open' : 'admin-shell'}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">EB</div>
            <div className="brand-copy">
              <strong>Eden Bowls</strong>
              <span>Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Fechar' : 'Menu'}
          </button>
        </div>

        <nav className="menu" id="admin-menu" aria-label="Seções do painel">
          {menuGroups.map((group) => (
            <div className="menu-group" key={group.group}>
              <p className="menu-group-label">{group.group}</p>
              <div className="menu-sub">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    aria-current={item.href === activeHref ? 'page' : undefined}
                    className={item.href === activeHref ? 'menu-link active' : 'menu-link'}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
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
