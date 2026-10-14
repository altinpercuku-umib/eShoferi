import { Link } from 'react-router'

const shortDate = (value) => new Date(value).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' })

// One column per recent exam, oldest on the left, with the pass mark as a line.
// The latest exam is highlighted and labelled; the others show their value on hover/focus,
// and the whole chart is also available as a table.
export default function ProgressChart({ exams, passPercent }) {
  const latest = exams.length - 1

  return (
    <figure className="chart">
      <p className="chart-key">
        <span className="chart-key-line" aria-hidden="true" />
        Kufiri i kalimit ({passPercent}%)
      </p>
      <div className="chart-plot">
        {[100, 50, 0].map((value) => (
          <span key={value} className="chart-gridline" style={{ '--y': `${value}%` }} aria-hidden="true">
            <span className="chart-tick">{value}%</span>
          </span>
        ))}
        <span className="chart-threshold" style={{ '--y': `${passPercent}%` }} aria-hidden="true">
          <span>{passPercent}%</span>
        </span>

        <ol className="chart-bars">
          {exams.map((exam, index) => {
            const kind = exam.category ?? 'Provim i plotë'
            const verdict = exam.passed ? 'kaluar' : 'jo i kaluar'
            return (
              <li key={exam.id} className={`chart-col${index === latest ? ' is-latest' : ''}`} style={{ '--h': `${exam.percent}%` }}>
                <Link
                  to={`/exams/${exam.id}`}
                  className="chart-bar"
                  aria-label={`${shortDate(exam.submitted_at)}, ${kind}: ${exam.percent}%, ${verdict}`}
                />
                {index === latest && (
                  <span className="chart-value" aria-hidden="true">
                    {Math.round(exam.percent)}%
                  </span>
                )}
                <span className="chart-tip" aria-hidden="true">
                  <strong>{exam.percent}%</strong>
                  <span>{kind}</span>
                  <span>
                    {shortDate(exam.submitted_at)}, {verdict}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {exams.length > 1 && (
        <div className="chart-axis" aria-hidden="true">
          <span>{shortDate(exams[0].submitted_at)}</span>
          <span>{shortDate(exams[latest].submitted_at)}</span>
        </div>
      )}

      <details className="chart-table">
        <summary>Shfaq si tabelë</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Lloji</th>
              <th scope="col">Rezultati</th>
              <th scope="col">Statusi</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td>{shortDate(exam.submitted_at)}</td>
                <td>{exam.category ?? 'Provim i plotë'}</td>
                <td>
                  {exam.score} / {exam.total} ({exam.percent}%)
                </td>
                <td>{exam.passed ? 'Kaluar' : 'Jo i kaluar'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
