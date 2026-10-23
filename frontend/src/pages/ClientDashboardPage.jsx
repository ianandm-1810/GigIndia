import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, MessageCircle, Plus, UsersRound } from 'lucide-react'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDate, formatRupees } from '../utils/format.js'
import { getId } from '../utils/format.js'

const progressSteps = ['Gig posted', 'Proposals', 'Student selected', 'Work submitted', 'Client closed', 'Payout processed']

function getProgress(gig) {
  const pendingCount = gig.proposalSummary?.pending || 0

  switch (gig.status) {
    case 'open':
      return { activeStep: 1, label: pendingCount ? 'Review proposals' : 'Waiting for proposals' }
    case 'in-progress':
      return { activeStep: 2, label: 'Project is in progress' }
    case 'submitted':
      return { activeStep: 3, label: ['paid', 'escrowed'].includes(gig.paymentStatus) ? 'Payment received — review the delivery and close the project' : 'Work submitted — payment is due' }
    case 'pending-admin-approval':
      return { activeStep: 4, label: 'Project closed — awaiting admin payout approval' }
    case 'payout-processing':
      return { activeStep: 4, label: 'Admin approved — Razorpay is processing the student payout' }
    case 'completed':
      return { activeStep: progressSteps.length, label: 'Project completed · payout processed' }
    case 'disputed':
      return { activeStep: 3, label: 'Dispute review — release is paused' }
    case 'cancelled':
      return { activeStep: -1, label: 'This gig was cancelled' }
    default:
      return { activeStep: 0, label: 'Status update unavailable' }
  }
}

function ProposalPreview({ proposal, gigId }) {
  return (
    <li className="client-proposal-row">
      <div className="client-proposal-person">
        <strong>{proposal.student?.name || 'Student'}</strong>
        <span>{proposal.student?.college || 'College not provided'}</span>
        {proposal.status === 'accepted' && proposal.student?.username && <Link className="proposal-student-profile-link" to={'/students/' + encodeURIComponent(proposal.student.username) + '?gigId=' + gigId}>Open student profile</Link>}
      </div>
      <div className="client-proposal-offer">
        <strong>{formatRupees(proposal.proposedAmount)}</strong>
        <span>{proposal.deliveryDays} days</span>
      </div>
      <Badge status={proposal.status} />
    </li>
  )
}

function StudentRating({ gig, reviewerId }) {
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get('/reviews/gig/' + gig._id).then(({ data }) => {
      if (active) setReviewed((data || []).some((item) => getId(item.reviewer) === reviewerId))
    }).catch(() => {})
    return () => { active = false }
  }, [gig._id, reviewerId])

  async function submitReview(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiClient.post('/reviews/' + gig._id, { rating: Number(rating), comment })
      setReviewed(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not submit this rating.'))
    } finally { setBusy(false) }
  }

  if (reviewed) return <p className="client-rating-thanks">You have rated this student's work. Thank you for sharing feedback.</p>
  return <form className="client-rating-form" onSubmit={submitReview}>
    <strong>Rate {gig.assignedTo?.name || 'the student'}’s work</strong>
    <div className="client-rating-inputs"><label>Rating<select value={rating} onChange={(event) => setRating(event.target.value)}><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Needs improvement</option><option value="1">1 — Poor</option></select></label><label>Feedback (optional)<input value={comment} maxLength="1000" onChange={(event) => setComment(event.target.value)} placeholder="Describe the student's work" /></label><Button type="submit" size="small" loading={busy}>Submit rating</Button></div>
    {error && <p className="form-alert" role="alert">{error}</p>}
  </form>
}

function ClientGigCard({ gig, userId }) {
  const summary = gig.proposalSummary || { total: 0, pending: 0, latest: [] }
  const progress = getProgress(gig)
  const assignedStudent = gig.assignedTo
  const canOpenChat = Boolean(assignedStudent && gig.chatAccess?.available)
  const gigActionLabel = summary.pending
    ? 'Review proposals'
    : gig.status === 'submitted' && ['paid', 'escrowed'].includes(gig.paymentStatus)
      ? 'Review submission & close project'
      : gig.status === 'submitted'
        ? 'Review delivery & payment'
        : ['pending-admin-approval', 'payout-processing'].includes(gig.status)
          ? 'View payout approval status'
          : 'View gig details'

  return (
    <article className="client-gig-card">
      <div className="client-gig-card-heading">
        <div>
          <p className="eyebrow">{gig.category?.replaceAll('-', ' ') || 'Project'} · Posted {formatDate(gig.createdAt)}</p>
          <h3><Link className="client-gig-title-link" to={'/gigs/' + gig._id}>{gig.title}</Link></h3>
        </div>
        <div className="admin-user-badges"><Badge status={gig.status} />{gig.isRemoved && <span className="admin-account-state removed">Hidden by admin</span>}</div>
      </div>

      <div className="client-gig-meta">
        <span><strong>{gig.agreedAmount ? 'Agreed price' : 'Budget'}</strong>{formatRupees(gig.agreedAmount || gig.budget)}</span>
        <span><strong>Deadline</strong>{formatDate(gig.deadline)}</span>
        <span><strong>Proposals</strong>{summary.total} received · {summary.pending} to review</span>
      </div>

      <div className="client-gig-progress" aria-label={'Progress: ' + progress.label}>
        <div className="client-gig-progress-heading">
          <strong>Project progress</strong>
          <span>{progress.label}</span>
        </div>
        <ol className="client-progress-steps">
          {progressSteps.map((step, index) => {
            const isComplete = progress.activeStep > index
            const isCurrent = progress.activeStep === index
            const stepClass = isComplete ? 'complete' : isCurrent ? 'current' : 'upcoming'
            return (
              <li className={'client-progress-step client-progress-' + stepClass} key={step} aria-current={isCurrent ? 'step' : undefined}>
                <span className="client-progress-marker" aria-hidden="true">{isComplete ? '✓' : index + 1}</span>
                <span>{step}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {assignedStudent && (
        <div className="client-assigned-student">
          <span>Selected student</span>
          <strong>{assignedStudent.name || 'Student assigned'}</strong>
          {assignedStudent.college && <small>{assignedStudent.college}</small>}
          {assignedStudent.username && <Link className="proposal-student-profile-link" to={'/students/' + encodeURIComponent(assignedStudent.username) + '?gigId=' + gig._id}>View selected student's profile</Link>}
        </div>
      )}

      {summary.latest.length > 0 && (
        <div className="client-proposal-preview">
          <div className="client-proposal-preview-heading">
            <strong>Recent proposals</strong>
            {summary.total > summary.latest.length && <span>Showing {summary.latest.length} of {summary.total}</span>}
          </div>
          <ul>
            {summary.latest.map((proposal) => <ProposalPreview key={proposal._id} proposal={proposal} gigId={gig._id} />)}
          </ul>
        </div>
      )}

      {gig.status === 'disputed' && (
        <p className="client-gig-notice">A dispute is open for this project. Payment release is paused while it is reviewed.</p>
      )}
        {gig.status === 'completed' && gig.paymentStatus === 'released' && assignedStudent && <StudentRating gig={gig} reviewerId={userId} />}
      {gig.chatAccess?.expiresAt && (
        <p className="client-chat-retention"><MessageCircle size={15} />
          {gig.chatAccess.available
            ? 'Project chat remains available until ' + formatDate(gig.chatAccess.expiresAt) + '.'
            : 'The 15-day project chat period ended on ' + formatDate(gig.chatAccess.expiresAt) + '.'}
        </p>
      )}

      <div className="client-gig-actions">
        <Button to={'/gigs/' + gig._id} variant="secondary">
          {gigActionLabel} <ArrowUpRight size={16} />
        </Button>
        {canOpenChat && <Button to={'/chat/' + gig._id}><MessageCircle size={16} /> Open project chat</Button>}
      </div>
    </article>
  )
}

export default function ClientDashboardPage() {
  const { user } = useAuth()
  const [gigs, setGigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      apiClient.get('/gigs/mine')
        .then(({ data }) => { if (active) { setGigs(Array.isArray(data) ? data : []); setError('') } })
        .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load your gigs and proposals.')) })
        .finally(() => { if (active) setLoading(false) })
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

  const pendingProposalCount = gigs.reduce((total, gig) => total + (gig.proposalSummary?.pending || 0), 0)
  const activeProjectCount = gigs.filter((gig) => ['in-progress', 'submitted', 'disputed'].includes(gig.status)).length
  const completedProjectCount = gigs.filter((gig) => gig.status === 'completed').length

  return (
    <div className="content-page">
      <PageHeading
        eyebrow="Client space"
        title={'Welcome, ' + (user?.name?.split(' ')[0] || 'client') + '.'}
        description="See proposals, follow each project’s progress, and return to the private chat with your selected student."
        action={<Button to="/post-gig"><Plus size={17} /> Post a gig</Button>}
      />

      <div className="dashboard-tip">
        <UsersRound size={19} />
        <div><strong>Good briefs make good matches.</strong><p>Share the expected outcome, budget, and a realistic deadline so students can send thoughtful proposals.</p></div>
        <Button to="/post-gig" variant="light" size="small">Create a brief</Button>
      </div>

      {!loading && !error && gigs.length > 0 && (
        <section className="client-overview" aria-label="Client project summary">
          <article><span>Your gigs</span><strong>{gigs.length}</strong></article>
          <article><span>Proposals to review</span><strong>{pendingProposalCount}</strong></article>
          <article><span>Active projects</span><strong>{activeProjectCount}</strong></article>
          <article><span>Completed</span><strong>{completedProjectCount}</strong></article>
        </section>
      )}

      <section className="dashboard-section client-projects-section">
        <div className="section-heading-row compact">
          <div><p className="eyebrow">Your workspace</p><h2>Your gigs and proposals</h2></div>
          {gigs.length > 0 && <Button to="/post-gig" variant="ghost">Post another <ArrowUpRight size={16} /></Button>}
        </div>
        {loading ? <LoadingState message="Loading your gigs and proposals..." /> : error ? <ErrorState message={error} /> : gigs.length ? (
          <div className="client-gig-list">{gigs.map((gig) => <ClientGigCard key={gig._id} gig={gig} userId={user?._id} />)}</div>
        ) : (
          <EmptyState
            title="No gigs yet"
            message="When you post a gig, incoming proposals, the selected student, project progress, and chat access will appear here."
            action={<Button to="/post-gig">Post your first gig</Button>}
          />
        )}
      </section>
    </div>
  )
}
