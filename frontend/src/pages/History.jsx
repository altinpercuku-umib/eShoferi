import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import PageLoader from '../components/PageLoader.jsx'
import useTitle from '../useTitle.js'

const dateFormat = { dateStyle: 'medium', timeStyle: 'short' }

export default function History() {
  const [exams, setExams] = useState(null)
  const [error, setError] = useState('')
  useTitle('Historiku')

  useEffect(() => {
    api.exams().then(setExams).catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    )
  }
  if (!exams) return <PageLoader />

  return (
    <section className="history">
      <h1>Historiku</h1>
      {exams.length === 0 ? (
        <div className="empty">
          <p>Ende nuk ke bërë asnjë provim.</p>
          <Link to="/exam" className="button">
            Fillo provimin e parë
          </Link>
        </div>
      ) : (
        <ul className="history-list">
          {exams.map((exam) => {
            const done = Boolean(exam.submitted_at)
            const status = !done ? 'I padorëzuar' : exam.passed ? 'Kaluar' : 'Jo i kaluar'
            return (
              <li key={exam.id}>
                <Link to={`/exams/${exam.id}`} className="history-row">
                  <span className="history-what">
                    <span className="history-kind">{exam.category ? exam.category.name : 'Provim i plotë'}</span>
                    <span className="history-date">{new Date(exam.started_at).toLocaleString('sq-AL', dateFormat)}</span>
                  </span>
                  <span className="history-score">{done ? `${exam.score} / ${exam.total}` : '–'}</span>
                  <span className={`badge ${!done ? 'badge-open' : exam.passed ? 'badge-pass' : 'badge-fail'}`}>
                    {status}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
