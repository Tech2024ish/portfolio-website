import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { adminApi } from '../api'
import { useAuth } from '../AdminApp'

export default function LoginPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={location.state?.from || '/admin'} replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await adminApi.login(email, password)
      setPassword('')
      setUser(data.user)
      navigate(location.state?.from?.startsWith('/admin') ? location.state.from : '/admin', {
        replace: true,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="studio-login">
      <div className="studio-login-brand">
        <span className="studio-monogram" aria-hidden="true">
          JC/
        </span>
        <h1>Portfolio studio</h1>
        <p>Owner workspace for goslish.vercel.app. Sign in to manage your public portfolio.</p>
      </div>
      <form className="studio-login-form" onSubmit={submit}>
        <h2>Sign in</h2>
        <div className="studio-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="studio-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="studio-alert danger" role="alert">
            {error}
          </p>
        )}
        <button className="studio-btn primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="studio-hint">
          Sessions end after 2 hours of inactivity. Forgotten password? Reset it from the server
          with
          <code> python -m scripts.create_owner</code>.
        </p>
        <a className="studio-hint" href="/">
          ← Back to the portfolio
        </a>
      </form>
    </div>
  )
}
