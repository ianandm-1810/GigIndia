import { Link } from 'react-router-dom'

export default function AuthPanel({ eyebrow = 'Your next chapter', title, description, children, footer }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <div className="auth-aside-orb" aria-hidden="true" />
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="text-link" to="/browse-gigs">Explore current gigs <span aria-hidden="true">↗</span></Link>
      </aside>
      <section className="auth-card" aria-label={title}>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </section>
    </div>
  )
}
