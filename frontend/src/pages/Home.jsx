import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { PrioritySign } from '../components/Signs.jsx'
import useTitle from '../useTitle.js'

function LastResult() {
  const [last, setLast] = useState(undefined)

  useEffect(() => {
    api
      .exams()
      .then((exams) => setLast(exams.find((exam) => exam.submitted_at) ?? null))
      .catch(() => setLast(null))
  }, [])

  if (!last) return null
  return (
    <p className="hero-last">
      Provimi yt i fundit: <strong>{last.score} nga {last.total}</strong>,{' '}
      {last.passed ? 'kaluar' : 'jo i kaluar'}. <Link to={`/exams/${last.id}`}>Shiko gabimet</Link>
    </p>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  useTitle(null)

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          {user ? (
            <>
              <h1>Mirë se u ktheve, {user.username}.</h1>
              <p className="lead">Bëj një provim të plotë me kohë, njësoj si në testin e vërtetë.</p>
              <div className="actions">
                <Link to="/exam" className="button">
                  Fillo provimin
                </Link>
                <Link to="/exams" className="button button-quiet">
                  Shiko historikun
                </Link>
              </div>
              <LastResult />
            </>
          ) : (
            <>
              <h1>Kalo testin e patentës që herën e parë.</h1>
              <p className="lead">
                Provime praktike me kohë, pyetje të rastësishme dhe shpjegim për çdo gabim. Falas.
              </p>
              <div className="actions">
                <Link to="/register" className="button">
                  Krijo llogari
                </Link>
                <Link to="/login" className="button button-quiet">
                  Kam llogari
                </Link>
              </div>
            </>
          )}
        </div>
        <PrioritySign className="hero-sign" />
      </section>

      {categories.length > 0 && (
        <section className="topics" aria-labelledby="topics-title">
          <h2 id="topics-title">Çfarë përfshin provimi</h2>
          <ul className="topic-list">
            {categories.map((category) => (
              <li key={category.id}>
                <h3>{category.name}</h3>
                {category.description && <p>{category.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
