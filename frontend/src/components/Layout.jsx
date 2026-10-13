import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth.jsx'

function readTheme() {
  try {
    return localStorage.getItem('theme')
  } catch {
    return null
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => readTheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  )

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Storage blocked - the theme still changes for this visit.
    }
    setTheme(next)
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={theme === 'dark' ? 'Kalo në pamjen e çelët' : 'Kalo në pamjen e errët'}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Kalo te përmbajtja
      </a>

      <header className="site-header">
        <Link to="/" className="wordmark" aria-label="eShoferi, faqja kryesore">
          <span className="wordmark-strip" aria-hidden="true">e</span>
          <span className="wordmark-name">Shoferi</span>
        </Link>

        <nav className="site-nav" aria-label="Navigimi kryesor">
          {user ? (
            <>
              <NavLink to="/exam">Provimi</NavLink>
              <NavLink to="/exams" end>
                Historiku
              </NavLink>
              <button type="button" className="link-button" onClick={handleLogout}>
                Dil
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Hyr</NavLink>
              <Link to="/register" className="button button-small">
                Regjistrohu
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </header>

      <main id="main" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>
            eShoferi është projekt praktike. Pyetjet janë për ushtrim dhe nuk janë pyetjet zyrtare të provimit.
          </p>
        </div>
      </footer>
    </div>
  )
}
