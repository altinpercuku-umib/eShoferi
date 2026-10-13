import { Link } from 'react-router'
import useTitle from '../useTitle.js'

export default function NotFound() {
  useTitle('Faqja nuk u gjet')
  return (
    <section className="message-page">
      <h1>Kjo faqe nuk ekziston.</h1>
      <p>
        <Link to="/">Kthehu në faqen kryesore</Link>
      </p>
    </section>
  )
}
