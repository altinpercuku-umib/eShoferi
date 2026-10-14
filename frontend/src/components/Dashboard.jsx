import { Link } from 'react-router'
import { levelOf } from '../levels.js'
import ProgressChart from './ProgressChart.jsx'

function Readiness({ stats }) {
  if (stats.readiness === null) {
    return (
      <div className="readiness">
        <p className="readiness-label">Gatishmëria për provim</p>
        <p className="readiness-empty">Bëj një provim të plotë dhe këtu do të shohësh sa gati je.</p>
      </div>
    )
  }

  const level = levelOf(stats.readiness, stats.pass_percent)
  const ready = level === 'good'
  const basis =
    stats.readiness_exams === 1
      ? 'Rezultati i provimit tënd të fundit të plotë.'
      : `Mesatarja e ${stats.readiness_exams} provimeve të fundit të plota.`

  return (
    <div className={`readiness is-${level}`}>
      <p className="readiness-label">Gatishmëria për provim</p>
      <p className="readiness-value">{Math.round(stats.readiness)}%</p>
      <div
        className="meter readiness-meter"
        role="meter"
        aria-label="Gatishmëria për provim"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stats.readiness}
        style={{ '--w': `${stats.readiness}%`, '--mark': `${stats.pass_percent}%` }}
      >
        <span className="meter-fill" />
        <span className="meter-mark" />
      </div>
      <p className="readiness-verdict">
        <strong>{ready ? 'Je gati.' : 'Ende jo gati.'}</strong> Kalimi kërkon {stats.pass_percent}%.
      </p>
      <p className="readiness-basis">{basis}</p>
    </div>
  )
}

function Kpi({ label, value, detail, to }) {
  const content = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-detail">{detail}</span>
    </>
  )
  return <li>{to ? <Link to={to} className="kpi">{content}</Link> : <div className="kpi">{content}</div>}</li>
}

export default function Dashboard({ user, stats }) {
  const accuracy = stats?.answered ? Math.round((stats.correct * 100) / stats.answered) : null

  return (
    <>
      <section className={`dash-hero${stats?.exams ? '' : ' is-solo'}`}>
        <div className="dash-greeting">
          <h1>Mirë se u ktheve, {user.username}.</h1>
          <p className="lead">Bëj një provim të plotë me kohë, njësoj si në testin e vërtetë.</p>
          <div className="actions">
            <Link to="/exam" className="button">
              Fillo provimin
            </Link>
            <Link to="/exams" className="button button-quiet">
              Historiku
            </Link>
          </div>
        </div>
        {stats?.exams > 0 && <Readiness stats={stats} />}
      </section>

      {stats && stats.exams === 0 && (
        <section className="dash-empty">
          <h2>Fillo me provimin e parë</h2>
          <p>Pas çdo provimi këtu shfaqen progresi yt, pikat e dobëta dhe vendi yt në renditje.</p>
        </section>
      )}

      {stats && stats.exams > 0 && (
        <>
          <ul className="kpis">
            <Kpi
              label="Provime të kaluara"
              value={stats.full_passed}
              detail={`nga ${stats.full_exams} të plota`}
            />
            <Kpi label="Përgjigje të sakta" value={`${accuracy}%`} detail={`${stats.correct} nga ${stats.answered}`} />
            <Kpi
              label="Rezultati më i mirë"
              value={stats.best_percent !== null ? `${Math.round(stats.best_percent)}%` : '–'}
              detail="në një provim të plotë"
            />
            <Kpi
              label="Renditja"
              value={stats.rank ? `#${stats.rank.position}` : '–'}
              detail={stats.rank ? `nga ${stats.rank.of} përdorues` : 'Shiko si renditesh'}
              to="/leaderboard"
            />
          </ul>

          <section className="dash-section" aria-labelledby="progress-title">
            <h2 id="progress-title">Provimet e fundit</h2>
            <ProgressChart exams={stats.recent} passPercent={stats.pass_percent} />
          </section>

          {stats.weakest && (
            <section className="weakest" aria-labelledby="weakest-title">
              <h2 id="weakest-title">Pika jote më e dobët</h2>
              <p>
                <strong>{stats.weakest.name}</strong>: {stats.weakest.correct} nga {stats.weakest.answered} përgjigje
                të sakta ({Math.round(stats.weakest.accuracy)}%).
              </p>
              <Link to={`/exam?category=${stats.weakest.id}`} className="button">
                Ushtro këtë kategori
              </Link>
            </section>
          )}
        </>
      )}
    </>
  )
}
