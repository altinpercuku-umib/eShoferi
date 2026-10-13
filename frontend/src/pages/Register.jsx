import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth.jsx'
import useTitle from '../useTitle.js'

function FieldErrors({ id, messages }) {
  if (!messages?.length) return null
  return (
    <ul className="field-error" id={id}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  useTitle('Regjistrohu')

  if (user) return <Navigate to="/" replace />

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await register(form)
      navigate('/exam', { replace: true })
    } catch (err) {
      const fieldErrors = err.data && typeof err.data === 'object' ? err.data : {}
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { detail: [err.message] })
      setBusy(false)
    }
  }

  const describedBy = (name, hintId) => [hintId, errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined

  return (
    <section className="auth-panel">
      <h1>Krijo llogari</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={update}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
          />
          <FieldErrors id="email-error" messages={errors.email} />
        </div>

        <div className="field">
          <label htmlFor="username">Emri i përdoruesit</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={form.username}
            onChange={update}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={describedBy('username', 'username-hint')}
          />
          <p className="field-hint" id="username-hint">
            Shfaqet në renditjen e përdoruesve. Email-i yt nuk shfaqet askund.
          </p>
          <FieldErrors id="username-error" messages={errors.username} />
        </div>

        <div className="field">
          <label htmlFor="password">Fjalëkalimi</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={update}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy('password', 'password-hint')}
          />
          <p className="field-hint" id="password-hint">
            Të paktën 8 karaktere, jo vetëm numra dhe jo i ngjashëm me email-in.
          </p>
          <FieldErrors id="password-error" messages={errors.password} />
        </div>

        {(errors.detail || errors.non_field_errors) && (
          <p className="form-error" role="alert">
            {[].concat(errors.detail ?? [], errors.non_field_errors ?? []).join(' ')}
          </p>
        )}

        <button type="submit" className="button button-block" disabled={busy}>
          {busy ? 'Duke krijuar llogarinë…' : 'Krijo llogari'}
        </button>
      </form>
      <p className="auth-switch">
        Ke llogari? <Link to="/login">Hyr</Link>
      </p>
    </section>
  )
}
