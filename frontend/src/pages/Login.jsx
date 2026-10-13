import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth.jsx'
import useTitle from '../useTitle.js'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useTitle('Hyr')

  const goTo = location.state?.from ?? '/'
  if (user) return <Navigate to={goTo} replace />

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form)
      navigate(goTo, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="auth-panel">
      <h1>Hyr</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} />
        </div>
        <div className="field">
          <label htmlFor="password">Fjalëkalimi</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={update}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button-block" disabled={busy}>
          {busy ? 'Duke hyrë…' : 'Hyr'}
        </button>
      </form>
      <p className="auth-switch">
        Nuk ke llogari? <Link to="/register">Regjistrohu</Link>
      </p>
    </section>
  )
}
