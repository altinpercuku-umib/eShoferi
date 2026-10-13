import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../api.js'
import PageLoader from '../components/PageLoader.jsx'
import { FailSign, PassSign } from '../components/Signs.jsx'
import useTitle from '../useTitle.js'

function ReviewItem({ item, number }) {
  const picked = new Set(item.selected)
  return (
    <li className={`review-item${item.is_correct ? ' is-right' : ' is-wrong'}`}>
      <h3>
        <span className="review-number">{number}.</span> {item.question_text}
      </h3>
      <p className="visually-hidden">{item.is_correct ? 'Përgjigje e saktë.' : 'Përgjigje e gabuar.'}</p>
      <ul className="review-answers">
        {item.answers.map((answer) => {
          const chosen = picked.has(answer.id)
          let note = null
          if (answer.is_correct && chosen) note = 'E saktë, e zgjodhe'
          else if (answer.is_correct) note = 'E saktë, nuk e zgjodhe'
          else if (chosen) note = 'E gabuar, e zgjodhe'
          return (
            <li
              key={answer.id}
              className={[answer.is_correct && 'is-correct', chosen && 'is-chosen'].filter(Boolean).join(' ')}
            >
              <span className="review-mark" aria-hidden="true">
                {answer.is_correct ? '✓' : chosen ? '✕' : ''}
              </span>
              <span>{answer.answer_text}</span>
              {note && <span className="review-note">{note}</span>}
            </li>
          )
        })}
      </ul>
      {item.explanation && <p className="explanation">{item.explanation}</p>}
    </li>
  )
}

export default function Result() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(null)
  useTitle('Rezultati')

  useEffect(() => {
    api.exam(id).then(setExam).catch((err) => setError(err.message))
  }, [id])

  if (error) {
    return (
      <section className="message-page">
        <h1>Ky provim nuk u gjet.</h1>
        <p>
          <Link to="/exams">Shko te historiku</Link>
        </p>
      </section>
    )
  }
  if (!exam) return <PageLoader />

  // Not submitted yet: either still running, or the time ran out.
  if (!exam.submitted_at) {
    const expired = new Date(exam.expires_at) < new Date()
    return (
      <section className="message-page">
        <h1>{expired ? 'Ky provim nuk u dorëzua në kohë.' : 'Ky provim është ende i hapur.'}</h1>
        <div className="actions">
          {expired ? (
            <Link to="/exam" className="button">
              Fillo një provim të ri
            </Link>
          ) : (
            <Link to={`/exam?attempt=${exam.id}`} className="button">
              Vazhdo provimin
            </Link>
          )}
        </div>
      </section>
    )
  }

  const wrong = exam.items.filter((item) => !item.is_correct)
  const activeFilter = filter ?? (wrong.length ? 'wrong' : 'all')
  const shown = activeFilter === 'wrong' ? wrong : exam.items

  return (
    <section className="result">
      <header className={`result-head ${exam.passed ? 'is-pass' : 'is-fail'}`}>
        {exam.passed ? <PassSign className="result-sign" /> : <FailSign className="result-sign" />}
        <div>
          <h1>{exam.passed ? 'Kalove.' : 'Nuk kalove këtë herë.'}</h1>
          <p className="result-score">
            <strong>{exam.score}</strong> nga {exam.total} pyetje të sakta
          </p>
          <p className="result-date">
            {exam.category ? `${exam.category.name}, ` : 'Provim i plotë, '}
            {new Date(exam.submitted_at).toLocaleString('sq-AL', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
      </header>

      <div className="actions">
        <Link to={exam.category ? `/exam?category=${exam.category.id}` : '/exam'} className="button">
          {exam.category ? 'Ushtro përsëri këtë kategori' : 'Bëj një provim tjetër'}
        </Link>
        <Link to="/exams" className="button button-quiet">
          Historiku
        </Link>
      </div>

      <div className="review-head">
        <h2>Rishikimi</h2>
        <div className="segmented" role="group" aria-label="Cilat pyetje të shfaqen">
          <button type="button" aria-pressed={activeFilter === 'wrong'} onClick={() => setFilter('wrong')}>
            Të gabuarat ({wrong.length})
          </button>
          <button type="button" aria-pressed={activeFilter === 'all'} onClick={() => setFilter('all')}>
            Të gjitha ({exam.items.length})
          </button>
        </div>
      </div>

      {shown.length ? (
        <ol className="review">
          {shown.map((item) => (
            <ReviewItem key={item.question} item={item} number={exam.items.indexOf(item) + 1} />
          ))}
        </ol>
      ) : (
        <p className="empty">Asnjë gabim. Të gjitha përgjigjet ishin të sakta.</p>
      )}
    </section>
  )
}
