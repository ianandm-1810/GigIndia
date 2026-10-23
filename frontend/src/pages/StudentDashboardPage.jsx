import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpenCheck, Clock3, Info, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import GigCard from '../components/features/GigCard.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDate, formatDateTime, formatRupees, getId } from '../utils/format.js'

function getWorkProgress(gig) {
  if (gig.status === 'completed') return 'Completed · payout released'
  if (gig.status === 'cancelled') return 'Closed · payment refunded or cancelled'
  if (gig.status === 'disputed') return 'Under dispute review'
  if (gig.status === 'pending-admin-approval') return 'Client closed the project · awaiting admin payout approval'
  if (gig.status === 'payout-processing') return 'Admin approved payout · Razorpay is processing it'
  if (gig.status === 'submitted' && ['paid', 'escrowed'].includes(gig.paymentStatus)) return 'Client payment received · awaiting project closure'
  if (gig.status === 'submitted') return 'Work submitted · awaiting client payment'
  if (gig.status === 'in-progress') return 'Work in progress'
  return 'Waiting for client decision'
}

function ApplicationCard({ entry, userId, unapplyingId, onUnapply }) {
  const { gig, proposal } = entry
  const isAssignedStudent = getId(gig.assignedTo) === userId
  const isSelectedProject = !proposal || proposal.status === 'accepted'
  const canOpenChat = isAssignedStudent && isSelectedProject && gig.chatAccess?.available
  const chatExpiry = isSelectedProject ? gig.chatAccess?.expiresAt : null

  return (
    <article className="student-history-card">
      <div className="student-history-heading">
        <div>
          <p className="eyebrow">{proposal ? 'Applied ' + formatDate(proposal.createdAt) : 'Project posted ' + formatDate(gig.createdAt)}</p>
          <h3><Link to={'/gigs/' + gig._id}>{gig.title}</Link></h3>
        </div>
        <div className="student-history-badges">
          {proposal ? <Badge status={proposal.status} /> : <span className="status-badge status-accepted">Selected</span>}
          <Badge status={gig.status} />
          {gig.isRemoved && <span className="admin-account-state removed">Hidden by admin</span>}
        </div>
      </div>

      <div className="student-history-details">
        <span><strong>Client</strong>{gig.client?.name || 'GIG INDIA client'}</span>
        <span><strong>Your proposal</strong>{proposal ? formatRupees(proposal.proposedAmount) : 'Assigned project'}</span>
        <span><strong>Project status</strong>{getWorkProgress(gig)}</span>
      </div>

      {proposal && <p className="student-history-offer">Your delivery estimate: {proposal.deliveryDays} days</p>}

      {proposal?.status === 'pending' && <div className="unapply-window"><Info size={15} /><span>You can withdraw this application until the client approves it.</span><Button variant="danger-ghost" size="small" onClick={() => onUnapply(proposal._id)} loading={unapplyingId === proposal._id}>Withdraw application</Button></div>}

      {chatExpiry && isAssignedStudent && (
        <p className="student-chat-retention"><Clock3 size={15} />
          {gig.chatAccess.available
            ? 'Project chat remains available until ' + formatDateTime(chatExpiry) + '.'
            : 'The 15-day project chat period ended on ' + formatDateTime(chatExpiry) + '.'}
        </p>
      )}

      <div className="student-history-actions">
        <Button to={'/gigs/' + gig._id} variant="secondary">View project <ArrowUpRight size={15} /></Button>
        {canOpenChat && <Button to={'/chat/' + gig._id}><MessageCircle size={16} /> Open project chat</Button>}
      </div>
    </article>
  )
}

export default function StudentDashboardPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [gigs, setGigs] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [unapplyingId, setUnapplyingId] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      apiClient.get('/gigs')
        .then(({ data }) => { if (active) { setGigs(Array.isArray(data) ? data.slice(0, 3) : []); setError('') } })
        .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load gig suggestions.')) })
        .finally(() => { if (active) setLoading(false) })

      apiClient.get('/gigs/student/mine')
        .then(({ data }) => { if (active) { setHistory(Array.isArray(data) ? data : []); setHistoryError('') } })
        .catch((requestError) => { if (active) setHistoryError(getErrorMessage(requestError, 'Could not load your applications and project history.')) })
        .finally(() => { if (active) setHistoryLoading(false) })
    }
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    const timer = window.setInterval(refreshWhenVisible, 30 * 1000)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [user?._id])

  async function unapply(proposalId) {
    setUnapplyingId(proposalId)
    try {
      const { data } = await apiClient.delete('/proposals/' + proposalId)
      setHistory((current) => current.map((entry) => entry.proposal?._id === proposalId
        ? { ...entry, proposal: data.proposal }
        : entry))
      showToast('Proposal withdrawn. It will stay in your history as withdrawn.')
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not withdraw this proposal.'), 'error')
    } finally {
      setUnapplyingId('')
    }
  }

  const activeCount = new Set(history.filter(({ gig }) => ['in-progress', 'submitted', 'pending-admin-approval', 'payout-processing', 'disputed'].includes(gig.status)).map(({ gig }) => gig._id)).size
  const completedCount = new Set(history.filter(({ gig }) => gig.status === 'completed').map(({ gig }) => gig._id)).size
  const pendingCount = history.filter(({ proposal }) => proposal?.status === 'pending').length

  return (
    <div className="content-page">
      <PageHeading eyebrow="Student space" title={'Good to see you, ' + (user?.name?.split(' ')[0] || 'there') + '.'} description="Find a project that fits your skills and the time you have." action={<><Button to="/student-chats" variant="secondary">Student chats</Button><Button to="/browse-gigs">Explore all gigs <ArrowUpRight size={16} /></Button></>} />
      <div className="dashboard-tip"><BookOpenCheck size={19} /><div><strong>Your portfolio starts with your work.</strong><p>Share accurate skills and deliver every project you accept. Add examples on your profile to help clients understand your strengths.</p></div><Button to="/profile" variant="light" size="small">Complete profile</Button></div>
      <div className="proposal-window-notice"><Info size={17} /><p>You can withdraw any pending application until the client approves it. After approval, the application cannot be withdrawn and the project chat becomes available.</p></div>

      <section className="dashboard-section student-history-section">
        <div className="section-heading-row compact"><div><p className="eyebrow">Applications and project history</p><h2>Your gigs, past and present</h2></div></div>
        {!historyLoading && !historyError && history.length > 0 && (
          <div className="client-overview student-overview" aria-label="Student work summary">
            <article><span>Applications</span><strong>{history.length}</strong></article>
            <article><span>Waiting for a reply</span><strong>{pendingCount}</strong></article>
            <article><span>Active projects</span><strong>{activeCount}</strong></article>
            <article><span>Completed</span><strong>{completedCount}</strong></article>
          </div>
        )}
        {historyLoading ? <LoadingState message="Loading your applications and gig history..." /> : historyError ? <ErrorState message={historyError} /> : history.length ? (
          <div className="student-history-list">{history.map((entry) => <ApplicationCard key={entry._id} entry={entry} userId={user?._id} unapplyingId={unapplyingId} onUnapply={unapply} />)}</div>
        ) : (
          <EmptyState title="No applications yet" message="When you apply to a gig or get selected for a project, it will stay listed here, including after it is completed." action={<Button to="/browse-gigs">Find your first gig</Button>} />
        )}
      </section>

      <section className="dashboard-section"><div className="section-heading-row compact"><div><p className="eyebrow">Picked from open listings</p><h2>Gigs to explore</h2></div><Button to="/browse-gigs" variant="ghost">See all <ArrowUpRight size={16} /></Button></div>
        {loading ? <LoadingState message="Finding open gigs..." /> : error ? <ErrorState message={error} /> : gigs.length ? <div className="gig-grid">{gigs.map((gig) => <GigCard key={gig._id} gig={gig} />)}</div> : <EmptyState title="No open gigs yet" message="New public gigs will appear here when clients post them." action={<Button to="/browse-gigs" variant="secondary">Check browse page</Button>} />}
      </section>
    </div>
  )
}
