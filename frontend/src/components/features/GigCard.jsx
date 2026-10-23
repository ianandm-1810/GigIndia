import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate, formatRupees } from '../../utils/format.js'
import Badge from '../common/Badge.jsx'

export default function GigCard({ gig }) {
  const clientName = gig.client?.name || 'GIG INDIA client'
  const initial = clientName.trim().slice(0, 1).toUpperCase()

  return (
    <article className="gig-card">
      <div className="gig-card-top">
        <span className="category-chip">{gig.category?.replaceAll('-', ' ') || 'Project'}</span>
        <Badge status={gig.status} />
      </div>
      <Link className="gig-card-title" to={'/gigs/' + gig._id}>
        <h2>{gig.title}</h2><ArrowUpRight size={19} aria-hidden="true" />
      </Link>
      <p className="gig-card-description">{gig.description}</p>
      <div className="gig-card-meta">
        <span className="client-avatar" aria-hidden="true">{initial}</span>
        <span>{clientName}</span>
        {gig.client?.college && <span className="meta-divider">·</span>}
        {gig.client?.college && <span>{gig.client.college}</span>}
      </div>
      <div className="gig-card-bottom">
        <strong>{formatRupees(gig.budget)}</strong>
        <span><CalendarDays size={15} aria-hidden="true" /> Due {formatDate(gig.deadline)}</span>
      </div>
    </article>
  )
}
