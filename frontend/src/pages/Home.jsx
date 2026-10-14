import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Dashboard from '../components/Dashboard.jsx'
import { levelOf } from '../levels.js'
import { NeonSigns } from '../components/Signs.jsx'
import useTitle from '../useTitle.js'

function Topics({ categories, accuracy, passPercent }) {
  if (categories.length === 0) return null
  return (
    <section className="topics" aria-labelledby="topics-title">
      <h2 id="topics-title">Ushtro sipas kategorisë</h2>
      <ul className="topic-list">
        {categories.map((category) => {
          const mine = accuracy[category.id]
          return (
            <li key={category.id}>
              <Link to={`/exam?category=${category.id}`} className="topic">
                <h3>{category.name}</h3>
                {category.description && <p className="topic-desc">{category.description}</p>}
                {mine && (
                  <span
                    className={`meter topic-meter is-${levelOf(mine.accuracy, passPercent)}`}
                    style={{ '--w': `${mine.accuracy}%` }}
                    aria-hidden="true"
                  >
                    <span className="meter-fill" />
                  </span>
                )}
                <p className="topic-count">
                  {category.question_count} pyetje
                  {mine && `. Ke ${Math.round(mine.accuracy)}% të sakta.`}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  useTitle(null)

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!user) return
    api.stats().then(setStats).catch(() => setStats(null))
  }, [user])

  const accuracy = Object.fromEntries((stats?.categories ?? []).map((c) => [c.id, c]))

  if (user) {
    return (
      <>
        <Dashboard user={user} stats={stats} />
        <Topics categories={categories} accuracy={accuracy} passPercent={stats?.pass_percent ?? 85} />
      </>
    )
  }

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <h1>Kalo testin e patentës që herën e parë.</h1>
          <p className="lead">Provime praktike me kohë, pyetje të rastësishme dhe shpjegim për çdo gabim. Falas.</p>
          <div className="actions">
            <Link to="/register" className="button">
              Krijo llogari
            </Link>
            <Link to="/login" className="button button-quiet">
              Kam llogari
            </Link>
          </div>
        </div>
        <NeonSigns className="hero-sign" />
      </section>
      <Topics categories={categories} accuracy={{}} passPercent={85} />
    </>
  )
}
