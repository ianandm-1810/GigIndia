import { ArrowLeft, Home } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <section className="not-found-page">
      <span className="not-found-number">404</span>
      <p className="eyebrow">Wrong turn, right place</p>
      <h1>This page isn’t here.</h1>
      <p>The link may be out of date, or the page may have moved.</p>
      <div className="button-row"><button className="button button-secondary" type="button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Go back</button><Link className="button button-primary" to="/"><Home size={17} /> Home</Link></div>
    </section>
  )
}
