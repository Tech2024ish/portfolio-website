import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { adminApi, UNAUTHORIZED_EVENT } from './api'
import { ToastProvider, useToast } from './ui'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import ProfilePage from './pages/ProfilePage'
import SkillsPage from './pages/SkillsPage'
import CareerPage from './pages/CareerPage'
import ResumePage from './pages/ResumePage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectEditorPage from './pages/ProjectEditorPage'
import ArticlesPage from './pages/ArticlesPage'
import ArticleEditorPage from './pages/ArticleEditorPage'
import MediaPage from './pages/MediaPage'
import InboxPage from './pages/InboxPage'
import SettingsPage from './pages/SettingsPage'
import './admin.css'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const NAV = [
  { to: '/admin', label: 'Overview', icon: 'grid', end: true },
  { to: '/admin/profile', label: 'Profile & content', icon: 'user' },
  { to: '/admin/projects', label: 'Projects', icon: 'layers' },
  { to: '/admin/writing', label: 'Writing', icon: 'pen' },
  { to: '/admin/media', label: 'Media', icon: 'image' },
  { to: '/admin/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
]

// Lucide icon paths (ISC licence), matching the Figma owner sidebar.
const ICONS = {
  grid: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  layers: (
    <>
      <path d="m12.83 2.18 8.58 3.91a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0L2.6 7.92a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0Z" />
      <path d="m2.6 12.08 8.58 3.9a2 2 0 0 0 1.65 0l8.58-3.9" />
      <path d="m2.6 17.08 8.58 3.9a2 2 0 0 0 1.65 0l8.58-3.9" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </>
  ),
  image: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  settings: (
    <>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
}

export function Icon({ name }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

/** Only an explicit 401/403 from the API proves there is no valid session. */
export const isAuthFailure = (error) => error?.status === 401 || error?.status === 403

function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = checking
  const [checkError, setCheckError] = useState(null) // network/server failure
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    const controller = new AbortController()
    adminApi
      .me(controller.signal)
      .then((data) => {
        setCheckError(null)
        setUser(data.user)
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        if (isAuthFailure(error)) {
          setCheckError(null)
          setUser(null)
        } else {
          // The server could not answer; the session may still be valid.
          setCheckError(error)
        }
      })
    return () => controller.abort()
  }, [attempt])

  const retryCheck = useCallback(() => {
    setCheckError(null)
    setUser(undefined)
    setAttempt((n) => n + 1)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await adminApi.logout()
    } catch (error) {
      if (!isAuthFailure(error)) {
        // The server did not confirm; the session cookie may still be valid.
        toast(`Could not sign out: ${error.message}`, 'danger')
        return
      }
    }
    setUser(null)
    navigate('/admin/login')
  }, [navigate, toast])

  // Any 401 from a protected call means the session ended: send the owner to sign in.
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, signOut, checkError, retryCheck }}>
      {children}
    </AuthContext.Provider>
  )
}

function SessionCheckError({ error, onRetry }) {
  return (
    <div className="studio-loading">
      <div className="studio-unavailable" role="alert">
        <span className="studio-monogram" aria-hidden="true">
          JC/
        </span>
        <h1>The studio can't reach the server</h1>
        <p>
          {error.message} Your session has not been ended; nothing was changed. If the server is
          waking up, this usually takes under a minute.
        </p>
        <button className="studio-btn primary" onClick={onRetry}>
          Try again
        </button>
        <a className="studio-hint" href="/">
          ← Back to the portfolio
        </a>
      </div>
    </div>
  )
}

function RequireOwner({ children }) {
  const { user, checkError, retryCheck } = useAuth()
  const location = useLocation()
  if (checkError) return <SessionCheckError error={checkError} onRetry={retryCheck} />
  if (user === undefined) return <div className="studio-loading">Checking your session…</div>
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  return children
}

function StudioLayout({ children }) {
  const { user, signOut } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const initials = (user?.display_name || 'O')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="studio">
      <a className="skip-link" href="#studio-main">
        Skip to content
      </a>
      <aside className={`studio-sidebar ${navOpen ? 'open' : ''}`}>
        <div className="studio-identity">
          <span className="studio-monogram" aria-hidden="true">
            JC/
          </span>
          <div>
            <strong>Portfolio studio</strong>
            <span>Owner workspace</span>
          </div>
          <button
            className="studio-nav-toggle"
            aria-expanded={navOpen}
            aria-controls="studio-nav"
            onClick={() => setNavOpen(!navOpen)}
          >
            Menu
          </button>
        </div>
        <nav
          id="studio-nav"
          className="studio-nav"
          aria-label="Studio"
          onClick={(event) => event.target.closest('a') && setNavOpen(false)}
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="studio-sidebar-note">
          <span>Public site</span>
          <a href="/" target="_blank" rel="noreferrer">
            View portfolio ↗
          </a>
        </div>
        <div className="studio-account">
          <span className="studio-initials" aria-hidden="true">
            {initials}
          </span>
          <div>
            <strong>{user?.display_name}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="studio-signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main id="studio-main" className="studio-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}

export default function AdminApp() {
  useEffect(() => {
    document.title = 'Portfolio studio'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => robots.remove()
  }, [])

  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <RequireOwner>
                <StudioLayout>
                  <Routes>
                    <Route index element={<OverviewPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="profile/skills" element={<SkillsPage />} />
                    <Route path="profile/career" element={<CareerPage />} />
                    <Route path="profile/resume" element={<ResumePage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="projects/:id" element={<ProjectEditorPage />} />
                    <Route path="writing" element={<ArticlesPage />} />
                    <Route path="writing/:id" element={<ArticleEditorPage />} />
                    <Route path="media" element={<MediaPage />} />
                    <Route path="inbox" element={<InboxPage />} />
                    <Route path="inbox/:id" element={<InboxPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                </StudioLayout>
              </RequireOwner>
            }
          />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
