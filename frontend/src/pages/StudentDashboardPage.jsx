import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpenCheck, Compass } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import GigCard from '../components/features/GigCard.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

export default function StudentDashboardPage() {
  const { user } = useAuth()
  const [gigs, setGigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get('/gigs')
      .then(({ data }) => setGigs(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch((requestError) => setError(getErrorMessage(requestError, 'Could not load gig suggestions.')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="content-page">
      <PageHeading eyebrow="Student space" title={'Good to see you, ' + (user?.name?.split(' ')[0] || 'there') + '.'} description="Find a project that fits your skills and the time you have." action={<Button to="/browse-gigs">Explore all gigs <ArrowUpRight size={16} /></Button>} />
      <div className="dashboard-tip"><BookOpenCheck size={19} /><div><strong>Your portfolio starts with your work.</strong><p>Share accurate skills and deliver every project you accept. Add examples on your profile to help clients understand your strengths.</p></div><Button to="/profile" variant="light" size="small">Complete profile</Button></div>
      <section className="dashboard-section"><div className="section-heading-row compact"><div><p className="eyebrow">Picked from open listings</p><h2>Gigs to explore</h2></div><Button to="/browse-gigs" variant="ghost">See all <ArrowUpRight size={16} /></Button></div>
        {loading ? <LoadingState message="Finding open gigs..." /> : error ? <ErrorState message={error} /> : gigs.length ? <div className="gig-grid">{gigs.map((gig) => <GigCard key={gig._id} gig={gig} />)}</div> : <EmptyState title="No open gigs yet" message="New public gigs will appear here when clients post them." action={<Button to="/browse-gigs" variant="secondary">Check browse page</Button>} />}
      </section>
      <Card className="dashboard-limitation"><span className="dashboard-limitation-icon"><Compass size={20} /></span><div><h2>Proposal and active-work history</h2><p>The current backend does not yet provide a student-specific proposal or assigned-gig list. Your applied and active work history will appear here once those endpoints are added.</p></div></Card>
    </div>
  )
}
