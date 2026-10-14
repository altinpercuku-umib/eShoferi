import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import PageLoader from '../components/PageLoader.jsx'
import useTitle from '../useTitle.js'

const PERIODS = [
  { id: 'all', label: 'Gjithë kohës' },
  { id: 'week', label: 'Këtë javë' },
]

function MyPosition({ data }) {
  const { user } = useAuth()
  if (!user) {
    return (
      <p className="board-me">
        <Link to="/register">Krijo llogari</Link> për të hyrë në renditje.
      </p>
    )
  }
  if (data.me) {
    return (
      <p className="board-me">
        Vendi yt: <strong>#{data.me.rank}</strong> me mesatare {data.me.average}%.
      </p>
    )
  }
  const missing = Math.max(data.min_exams - (data.my_exams ?? 0), 1)
  return (
    <p className="board-me">
      Bëj edhe {missing} {missing === 1 ? 'provim të plotë' : 'provime të plota'} për t'u shfaqur këtu.{' '}
      <Link to="/exam">Fillo tani</Link>
    </p>
  )
}

export default function Leaderboard() {
  const [period, setPeriod] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useTitle('Renditja')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .leaderboard(period)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [period])

  return (
    <section className="board">
      <h1>Renditja</h1>
      <p className="board-intro">
        Renditja bëhet sipas mesatares së provimeve të plota. Ushtrimet sipas kategorisë nuk llogariten.
      </p>

      <div className="segmented board-periods" role="group" aria-label="Periudha">
        {PERIODS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={period === option.id}
            onClick={() => setPeriod(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!data && loading && <PageLoader />}

      {data && (
        // While a new period loads, the old list stays visible (dimmed) instead of jumping.
        <div className={loading ? 'is-refreshing' : undefined} aria-busy={loading}>
          <MyPosition data={data} />

          {data.results.length === 0 ? (
            <p className="empty">
              Ende askush nuk ka {data.min_exams} provime të plota
              {period === 'week' ? ' këtë javë' : ''}. Mund të jesh i pari.
            </p>
          ) : (
            <ol className="board-list">
              {data.results.map((row) => (
                <li
                  key={`${row.rank}-${row.username}`}
                  className={['board-row', row.rank === 1 && 'is-first', row.is_me && 'is-me'].filter(Boolean).join(' ')}
                  aria-current={row.is_me ? 'true' : undefined}
                >
                  <span className="board-rank">#{row.rank}</span>
                  <span className="board-name">
                    {row.username}
                    {row.is_me && <span className="board-you"> (ti)</span>}
                  </span>
                  <span className="board-average">{row.average}%</span>
                  <span className="board-exams">
                    {row.exams} provime, {row.passed} të kaluara
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
