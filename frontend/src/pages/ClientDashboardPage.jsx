import { useEffect, useState } from 'react'
import { ArrowUpRight, Plus, UsersRound } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import GigCard from '../components/features/GigCard.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'
import { getId } from '../utils/format.js'

export default function ClientDashboardPage() {
  const { user } = useAuth()
  const [gigs, setGigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get('/gigs')
      .then(({ data }) => {
        const ownOpenGigs = Array.isArray(data) ? data.filter((gig) => getId(gig.client) === user?._id) : []
        setGigs(ownOpenGigs)
      })
      .catch((requestError) => setError(getErrorMessage(requestError, 'Could not load your open gigs.')))
      .finally(() => setLoading(false))
  }, [user?._id])

  return (
    <div className="content-page">
      <PageHeading eyebrow="Client space" title={'Welcome, ' + (user?.name?.split(' ')[0] || 'client') + '.'} description="Post clear projects and review the proposals you receive." action={<Button to="/post-gig"><Plus size={17} /> Post a gig</Button>} />
      <div className="dashboard-tip"><UsersRound size={19} /><div><strong>Good briefs make good matches.</strong><p>Share the expected outcome, budget, and a realistic deadline so students can send thoughtful proposals.</p></div><Button to="/post-gig" variant="light" size="small">Create a brief</Button></div>
      <section className="dashboard-section"><div className="section-heading-row compact"><div><p className="eyebrow">Open listings</p><h2>Your active posts</h2></div><Button to="/post-gig" variant="ghost">Post another <ArrowUpRight size={16} /></Button></div>
        {loading ? <LoadingState message="Loading your open gigs..." /> : error ? <ErrorState message={error} /> : gigs.length ? <div className="gig-grid">{gigs.map((gig) => <GigCard key={gig._id} gig={gig} />)}</div> : <EmptyState title="No open gigs yet" message="Your open job posts appear here. Completed or in-progress gig history is not included in the current list endpoint." action={<Button to="/post-gig">Post your first gig</Button>} />}
      </section>
      <Card className="dashboard-limitation"><span className="dashboard-limitation-icon"><UsersRound size={20} /></span><div><h2>Proposal notifications</h2><p>Open a gig to see its proposals. The backend currently provides proposals per gig, rather than a combined client inbox.</p></div></Card>
    </div>
  )
}
