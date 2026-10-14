import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth.jsx'
import { LogoMark } from './Signs.jsx'

function readTheme() {
  try {
    return localStorage.getItem('theme')
  } catch {
    return null
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => (readTheme() === 'light' ? 'light' : 'dark'))

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    // The phone's status bar follows the theme too.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#f3f5f9' : '#070b14')
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Storage blocked - the theme still changes for this visit.
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Kalo në pamjen e çelët' : 'Kalo në pamjen e errët'}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}

const TAB_ICONS = {
  home: <path d="M4 11.2 12 4.5l8 6.7V19.5a1 1 0 0 1-1 1h-4.6v-5.8H9.6v5.8H5a1 1 0 0 1-1-1Z" />,
  exam: (
    <>
      <path d="M12 2.8 21.2 12 12 21.2 2.8 12Z" />
      <path d="M9.2 15.6 11.3 8.6M14.8 15.6 12.7 8.6" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
  board: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M9.2 20.5V8.5h5.6v12" />
      <path d="M4.2 20.5v-7h5M14.8 15.5h5v5" />
    </>
  ),
}

// Phones: the main navigation sits at the bottom, where the thumb reaches.
function TabBar() {
  const tabs = [
    { to: '/', label: 'Kryefaqja', icon: 'home', end: true },
    { to: '/exam', label: 'Provimi', icon: 'exam' },
    { to: '/exams', label: 'Historiku', icon: 'history' },
    { to: '/leaderboard', label: 'Renditja', icon: 'board' },
  ]
  return (
    <nav className="tabbar" aria-label="Navigimi kryesor">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
          <svg
            className="tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {TAB_ICONS[tab.icon]}
          </svg>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
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
    <div className={`shell${user ? ' has-tabbar' : ''}`}>
      <a className="skip-link" href="#main">
        Kalo te përmbajtja
      </a>

      <header className="site-header">
        <Link to="/" className="wordmark" aria-label="eShoferi, faqja kryesore">
          <LogoMark />
          <span className="wordmark-text" aria-hidden="true">
            <span className="wordmark-e">e</span>Shoferi
          </span>
        </Link>

        <div className="site-nav">
          {user ? (
            <>
              <nav className="nav-desktop" aria-label="Navigimi kryesor">
                <NavLink to="/exam">Provimi</NavLink>
                <NavLink to="/exams">Historiku</NavLink>
                <NavLink to="/leaderboard">Renditja</NavLink>
              </nav>
              <button type="button" className="link-button" onClick={handleLogout}>
                Dil
              </button>
            </>
          ) : (
            <>
              <NavLink to="/leaderboard" className="nav-desktop-link">
                Renditja
              </NavLink>
              <NavLink to="/login">Hyr</NavLink>
              <Link to="/register" className="button button-small">
                Regjistrohu
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
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

      {user && <TabBar />}
    </div>
  )
}
