// Small wrapper around fetch for talking to the Django API.
// - sends cookies (the JWTs live in httpOnly cookies the browser handles for us)
// - adds the CSRF header to every write request
// - when the 5-minute access token expires (401), refreshes once and retries

const BASE = '/api'
const GENERIC_ERROR = 'Diçka shkoi keq. Provo përsëri.'

// Endpoints where a 401 must NOT trigger a refresh-and-retry.
const NO_REFRESH = ['/auth/csrf/', '/auth/login/', '/auth/register/', '/auth/refresh/', '/auth/logout/']

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

function messageFrom(data) {
  if (!data) return GENERIC_ERROR
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.join(' ')
  if (data.detail) return data.detail
  if (data.non_field_errors) return data.non_field_errors.join(' ')
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first.join(' ') : String(first ?? GENERIC_ERROR)
}

export class ApiError extends Error {
  constructor(status, data) {
    super(messageFrom(data))
    this.status = status
    this.data = data ?? {}
  }
}

async function send(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRFToken'] = getCookie('csrftoken') ?? ''

  let response
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { detail: 'Serveri nuk përgjigjet. Kontrollo lidhjen dhe provo përsëri.' })
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

// If several requests hit a 401 at the same moment, they share ONE refresh.
// Two parallel refreshes would fail: the first one blacklists the token the second one sends.
let refreshInFlight = null

function refreshSession() {
  refreshInFlight ??= send('/auth/refresh/', { method: 'POST' }).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function request(path, options) {
  try {
    return await send(path, options)
  } catch (error) {
    if (error.status === 401 && !NO_REFRESH.includes(path)) {
      await refreshSession() // throws if the session is really over
      return send(path, options)
    }
    throw error
  }
}

export const api = {
  csrf: () => send('/auth/csrf/'),
  me: () => request('/auth/me/'),
  login: (credentials) => send('/auth/login/', { method: 'POST', body: credentials }),
  register: (details) => send('/auth/register/', { method: 'POST', body: details }),
  logout: () => send('/auth/logout/', { method: 'POST' }),

  categories: () => request('/categories/'),
  startExam: () => request('/exams/', { method: 'POST' }),
  exams: () => request('/exams/'),
  exam: (id) => request(`/exams/${id}/`),
  submitExam: (id, answers) => request(`/exams/${id}/submit/`, { method: 'POST', body: { answers } }),
}
