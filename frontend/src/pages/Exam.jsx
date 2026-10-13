import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../api.js'
import PageLoader from '../components/PageLoader.jsx'
import Timer from '../components/Timer.jsx'
import { clearProgress, loadProgress, saveProgress } from '../examProgress.js'
import useTitle from '../useTitle.js'

const LETTERS = 'ABCDEFGH'
const SWIPE_DISTANCE = 60 // pixels a finger must travel sideways to count as a swipe

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
  const [direction, setDirection] = useState('next')
  const [answers, setAnswers] = useState({}) // { questionId: [answerId, ...] }
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [rules, setRules] = useState(null)
  const [categories, setCategories] = useState([])
  const [mode, setMode] = useState(requestedCategory ?? 'full') // 'full' or a category id
  const loadedRef = useRef(false)
  const questionHeadingRef = useRef(null)
  const touchRef = useRef(null)
  useTitle('Provimi')

  function begin(data, isNew) {
    // For a new exam we count down from the duration, using this device's clock,
    // so a wrong clock on the user's phone can't shorten or lengthen the exam.
    const duration = new Date(data.expires_at) - new Date(data.started_at)
    setDeadline(isNew ? Date.now() + duration : new Date(data.expires_at).getTime())

    // When continuing an exam, bring back the answers saved on this device.
    const saved = isNew ? null : loadProgress(data.id)
    setExam(data)
    setAnswers(saved?.answers ?? {})
    setCurrent(Math.min(saved?.current ?? 0, data.questions.length - 1))
    setDirection('next')
    setPhase('running')
  }

  // Continuing an exam: from the history page, or after the page reloaded (/exam?attempt=12).
  useEffect(() => {
    if (!resumeId || loadedRef.current) return
    loadedRef.current = true
    api
      .exam(resumeId)
      .then((data) => {
        if (data.questions) begin(data, false)
        else {
          clearProgress(data.id)
          navigate(`/exams/${data.id}`, { replace: true }) // already submitted
        }
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
    api
      .categories()
      .then((list) => setCategories(list.filter((c) => c.question_count > 0)))
      .catch(() => {})
  }, [resumeId])

  useEffect(() => {
    if (requestedCategory) setMode(requestedCategory)
  }, [requestedCategory])

  async function start() {
    setPhase('loading')
    setError('')
    try {
      const data = await api.startExam(mode === 'full' ? null : mode)
      loadedRef.current = true // already loaded - don't fetch it again when the URL changes below
      begin(data, true)
      // Put the attempt in the URL, so a reload continues this exam instead of starting over.
      navigate(`/exam?attempt=${data.id}`, { replace: true })
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
      clearProgress(exam.id)
      navigate(`/exams/${exam.id}`, { replace: true })
    } catch (err) {
      // 400 = already submitted or too late. The results page explains which.
      if (err.status === 400) {
        clearProgress(exam.id)
        navigate(`/exams/${exam.id}`, { replace: true })
      } else {
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
      const target = Math.min(Math.max(index, 0), total - 1)
      if (target === current) return
      setDirection(target > current ? 'next' : 'prev')
      setCurrent(target)
      setConfirming(false)
    },
    [total, current],
  )

  // Save progress on this device after every change.
  useEffect(() => {
    if (phase === 'running' && exam) saveProgress(exam.id, { answers, current })
  }, [phase, exam, answers, current])

  // While the exam runs: hide the tab bar and the header on phones, and stop
  // pull-to-refresh from reloading the page by accident.
  useEffect(() => {
    if (phase !== 'running') return
    const root = document.documentElement
    root.dataset.mode = 'exam'
    return () => {
      delete root.dataset.mode
    }
  }, [phase])

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

  // Touch screens: swipe left for the next question, right for the previous one.
  function onTouchStart(event) {
    const touch = event.touches[0]
    touchRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function onTouchEnd(event) {
    const start = touchRef.current
    touchRef.current = null
    if (!start || event.changedTouches.length === 0) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Only clearly sideways movements count, so normal scrolling never changes the question.
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    goTo(dx < 0 ? current + 1 : current - 1)
  }

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
          <li className="hint-touch">Rrëshqit majtas ose djathtas për të kaluar nga një pyetje te tjetra.</li>
          <li className="hint-keyboard">Me tastierë: 1–4 zgjedhin përgjigjen, shigjetat kalojnë nga një pyetje te tjetra.</li>
        </ul>

        <div className="intro-dock">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="button" onClick={start}>
            {mode === 'full' ? 'Fillo provimin' : 'Fillo ushtrimin'}
          </button>
        </div>
      </section>
    )
  }

  const unanswered = total - answeredCount
  const isLast = current === total - 1

  return (
    <section className="exam" aria-labelledby="question-heading">
      <div className="exam-top">
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
      </div>

      <div
        key={question.id}
        className={`question slide-${direction}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
        <div className="confirm exam-dock" role="alertdialog" aria-labelledby="confirm-text">
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
        <div className="exam-dock">
          <button
            type="button"
            className="button button-quiet"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
          >
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
