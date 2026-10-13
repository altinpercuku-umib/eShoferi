import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../api.js'
import PageLoader from '../components/PageLoader.jsx'
import Timer from '../components/Timer.jsx'
import useTitle from '../useTitle.js'

const LETTERS = 'ABCDEFGH'

function isTyping(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}

export default function Exam() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resumeId = searchParams.get('attempt')
  const requestedCategory = Number(searchParams.get('category')) || null

  const [phase, setPhase] = useState(resumeId ? 'loading' : 'intro') // intro | loading | running | submitting
  const [exam, setExam] = useState(null)
  const [deadline, setDeadline] = useState(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({}) // { questionId: [answerId, ...] }
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [rules, setRules] = useState(null)
  const [categories, setCategories] = useState([])
  const [mode, setMode] = useState(requestedCategory ?? 'full') // 'full' or a category id
  const loadedRef = useRef(false)
  const questionHeadingRef = useRef(null)
  useTitle('Provimi')

  function begin(data, isNew) {
    // For a new exam we count down from the duration, using this computer's clock,
    // so a wrong clock on the user's PC can't shorten or lengthen the exam.
    const duration = new Date(data.expires_at) - new Date(data.started_at)
    setDeadline(isNew ? Date.now() + duration : new Date(data.expires_at).getTime())
    setExam(data)
    setCurrent(0)
    setAnswers({})
    setPhase('running')
  }

  // Resuming an unfinished exam from the history page: /exam?attempt=12
  useEffect(() => {
    if (!resumeId || loadedRef.current) return
    loadedRef.current = true
    api
      .exam(resumeId)
      .then((data) => {
        if (data.questions) begin(data, false)
        else navigate(`/exams/${data.id}`, { replace: true }) // already submitted
      })
      .catch((err) => {
        setError(err.message)
        setPhase('intro')
      })
  }, [resumeId, navigate])

  // The start screen needs the exam rules and the categories to choose from.
  useEffect(() => {
    if (resumeId) return
    api.examRules().then(setRules).catch(() => {})
    api.categories().then((list) => setCategories(list.filter((c) => c.question_count > 0))).catch(() => {})
  }, [resumeId])

  useEffect(() => {
    if (requestedCategory) setMode(requestedCategory)
  }, [requestedCategory])

  async function start() {
    setPhase('loading')
    setError('')
    try {
      begin(await api.startExam(mode === 'full' ? null : mode), true)
    } catch (err) {
      setError(err.message)
      setPhase('intro')
    }
  }

  const submit = useCallback(async () => {
    if (!exam) return
    setPhase('submitting')
    setConfirming(false)
    const payload = exam.questions.map((question) => ({ question: question.id, selected: answers[question.id] ?? [] }))
    try {
      await api.submitExam(exam.id, payload)
      navigate(`/exams/${exam.id}`)
    } catch (err) {
      // 400 = already submitted or too late. The results page explains which.
      if (err.status === 400) navigate(`/exams/${exam.id}`)
      else {
        setError(err.message)
        setPhase('running')
      }
    }
  }, [exam, answers, navigate])

  const total = exam?.questions.length ?? 0
  const question = exam?.questions[current]
  const selected = question ? (answers[question.id] ?? []) : []
  const answeredCount = exam ? exam.questions.filter((q) => answers[q.id]?.length).length : 0

  const toggle = useCallback(
    (answerId) => {
      if (!question) return
      setAnswers((previous) => {
        const picked = previous[question.id] ?? []
        const next = picked.includes(answerId) ? picked.filter((id) => id !== answerId) : [...picked, answerId]
        return { ...previous, [question.id]: next }
      })
    },
    [question],
  )

  const goTo = useCallback(
    (index) => {
      setCurrent(Math.min(Math.max(index, 0), total - 1))
      setConfirming(false)
    },
    [total],
  )

  // Move focus to the new question so keyboard and screen-reader users follow along,
  // and scroll the road strip so the current question stays visible.
  useEffect(() => {
    if (phase !== 'running') return
    questionHeadingRef.current?.focus()
    document.querySelector('.road-stop[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [current, phase])

  // Keyboard shortcuts: 1-4 pick answers, arrow keys move between questions.
  useEffect(() => {
    if (phase !== 'running' || !question) return
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      const number = Number(event.key)
      if (number >= 1 && number <= question.answers.length) {
        toggle(question.answers[number - 1].id)
      } else if (event.key === 'ArrowRight') {
        goTo(current + 1)
      } else if (event.key === 'ArrowLeft') {
        goTo(current - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, question, current, toggle, goTo])

  // Warn before closing the tab in the middle of an exam.
  useEffect(() => {
    if (phase !== 'running') return
    function onBeforeUnload(event) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])

  if (phase === 'loading') return <PageLoader label="Duke përgatitur provimin…" />
  if (phase === 'submitting') return <PageLoader label="Duke dorëzuar provimin…" />

  if (phase === 'intro') {
    const practiceCount = (category) => Math.min(rules?.practice_question_count ?? 10, category.question_count)
    return (
      <section className="exam-intro">
        <h1>Zgjidh provimin</h1>

        <fieldset className="mode-picker">
          <legend className="visually-hidden">Lloji i provimit</legend>
          <label className={`mode${mode === 'full' ? ' is-selected' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'full'} onChange={() => setMode('full')} />
            <span className="mode-name">Provim i plotë</span>
            <span className="mode-meta">
              {rules
                ? `${rules.question_count} pyetje nga të gjitha kategoritë, ${rules.duration_minutes} minuta. Kalon me ${rules.pass_percent}%.`
                : 'Pyetje nga të gjitha kategoritë, me kohë si në testin e vërtetë.'}
            </span>
          </label>

          {categories.length > 0 && <p className="mode-group">Ushtro një kategori</p>}
          {categories.map((category) => (
            <label key={category.id} className={`mode${mode === category.id ? ' is-selected' : ''}`}>
              <input type="radio" name="mode" checked={mode === category.id} onChange={() => setMode(category.id)} />
              <span className="mode-name">{category.name}</span>
              <span className="mode-meta">{practiceCount(category)} pyetje</span>
            </label>
          ))}
        </fieldset>

        <ul className="rules">
          <li>Disa pyetje kanë më shumë se një përgjigje të saktë. Pyetja llogaritet e saktë vetëm nëse i zgjedh të gjitha.</li>
          <li>Koha fillon sapo shtyp butonin. Kur mbaron, provimi dorëzohet vetë.</li>
          <li>Me tastierë: 1–4 zgjedhin përgjigjen, shigjetat kalojnë nga një pyetje te tjetra.</li>
        </ul>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="button" onClick={start}>
          {mode === 'full' ? 'Fillo provimin' : 'Fillo ushtrimin'}
        </button>
      </section>
    )
  }

  const unanswered = total - answeredCount
  const isLast = current === total - 1

  return (
    <section className="exam" aria-labelledby="question-heading">
      {exam.category && <p className="exam-category">{exam.category.name}</p>}
      <div className="exam-bar">
        <p className="exam-count">
          Pyetja <strong>{current + 1}</strong> nga {total}
        </p>
        <Timer deadline={deadline} onExpire={submit} />
      </div>

      <nav className="road" aria-label="Pyetjet e provimit">
        <ol>
          {exam.questions.map((q, index) => {
            const answered = Boolean(answers[q.id]?.length)
            return (
              <li key={q.id}>
                <button
                  type="button"
                  className={`road-stop${answered ? ' is-answered' : ''}`}
                  aria-current={index === current ? 'step' : undefined}
                  aria-label={`Pyetja ${index + 1}${answered ? ', e përgjigjur' : ''}`}
                  onClick={() => goTo(index)}
                >
                  {index + 1}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="question">
        <h1 id="question-heading" ref={questionHeadingRef} tabIndex={-1}>
          {question.question_text}
        </h1>
        <p className="question-hint" id="question-hint">
          Zgjidh një ose më shumë përgjigje.
        </p>

        <ul className="options" aria-describedby="question-hint">
          {question.answers.map((answer, index) => {
            const isSelected = selected.includes(answer.id)
            return (
              <li key={answer.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  className={`option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => toggle(answer.id)}
                >
                  <span className="option-key" aria-hidden="true">
                    {LETTERS[index]}
                  </span>
                  <span className="option-text">{answer.answer_text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-text">
          <p id="confirm-text">
            {unanswered > 0
              ? `Ke ${unanswered} pyetje pa përgjigje. Pas dorëzimit nuk mund t'i ndryshosh më.`
              : "Pas dorëzimit nuk mund t'i ndryshosh më përgjigjet."}
          </p>
          <div className="actions">
            <button type="button" className="button" onClick={submit} autoFocus>
              Dorëzo provimin
            </button>
            <button type="button" className="button button-quiet" onClick={() => setConfirming(false)}>
              Kthehu te pyetjet
            </button>
          </div>
        </div>
      ) : (
        <div className="exam-nav">
          <button type="button" className="button button-quiet" onClick={() => goTo(current - 1)} disabled={current === 0}>
            E mëparshmja
          </button>
          {isLast ? (
            <button type="button" className="button" onClick={() => setConfirming(true)}>
              Dorëzo provimin
            </button>
          ) : (
            <button type="button" className="button" onClick={() => goTo(current + 1)}>
              Tjetra
            </button>
          )}
        </div>
      )}

      {!isLast && !confirming && (
        <p className="exam-early">
          <button type="button" className="link-button" onClick={() => setConfirming(true)}>
            Dorëzo tani ({answeredCount} nga {total} të përgjigjura)
          </button>
        </p>
      )}
    </section>
  )
}
