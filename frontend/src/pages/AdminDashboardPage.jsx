import { useEffect, useState } from 'react'
import { ExternalLink, Search, ShieldCheck, UserRoundCog } from 'lucide-react'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import AdminChatViewer from '../components/features/AdminChatViewer.jsx'
import AdminStudentChatViewer from '../components/features/AdminStudentChatViewer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDate, formatDateTime, formatRupees } from '../utils/format.js'

const views = [
  { id: 'users', label: 'Users' },
  { id: 'gigs', label: 'Gig history' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'payments', label: 'Payments' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'studentChats', label: 'Student chats' },
]

function SummaryCard({ label, value, tone = '' }) {
  return <article className={'admin-summary-card ' + tone}><span>{label}</span><strong>{value}</strong></article>
}

function AdminGigCard({ gig, onOpenChat, onToggleRemoval, onDeleteGig, busy }) {
  const summary = gig.proposalSummary || { total: 0, pending: 0, latest: [] }
  const deleteBlockReason = gig.assignedTo || !['open', 'cancelled'].includes(gig.status)
    ? 'Only unassigned, unstarted gigs can be permanently deleted.'
    : gig.paymentStatus !== 'pending' || gig.razorpayOrderId || (gig.paymentCount || 0) > 0
      ? 'Payment activity exists; remove the listing to preserve its payment history.'
      : summary.total > 0 || (gig.messageCount || 0) > 0 || (gig.reviewCount || 0) > 0
        ? 'Applications, chat, or review history exists; remove the listing to preserve it.'
        : ''
  return (
    <article className="admin-record-card">
      <div className="admin-record-heading">
        <div><p className="eyebrow">Posted {formatDate(gig.createdAt)} · {gig.category?.replaceAll('-', ' ') || 'Project'}</p><h3>{gig.title}</h3></div>
        <div className="admin-user-badges"><Badge status={gig.status} />{gig.isRemoved && <span className="admin-account-state removed">removed from listings</span>}</div>
      </div>
      <div className="admin-record-details">
        <span><strong>Client</strong>{gig.client?.name || 'Deleted account'}{gig.client?.email ? ' · ' + gig.client.email : ''}</span>
        <span><strong>Selected student</strong>{gig.assignedTo?.name || 'Not assigned'}{gig.assignedTo?.email ? ' · ' + gig.assignedTo.email : ''}</span>
        <span><strong>Budget</strong>{formatRupees(gig.budget)}</span>
        <span><strong>Proposal activity</strong>{summary.total} total · {summary.pending} pending</span>
      </div>
      <div className="admin-record-details admin-payment-details">
        <span><strong>Gig payment</strong><Badge status={gig.paymentStatus} /></span>
        <span><strong>Payment record</strong>{gig.payment ? <Badge status={gig.payment.status} /> : 'No payment record'}</span>
        {gig.payment && <span><strong>Student amount / platform fee</strong>{formatRupees(gig.payment.studentAmount)} / {formatRupees(gig.payment.platformFee)}</span>}
        {gig.chatAccess?.expiresAt && <span><strong>Chat retention ends</strong>{formatDateTime(gig.chatAccess.expiresAt)}{gig.chatAccess.available ? '' : ' · expired'}</span>}
      </div>
      {summary.latest?.length > 0 && <div className="admin-proposal-preview"><strong>Recent proposals</strong><ul>{summary.latest.map((proposal) => <li key={proposal._id}><span>{proposal.student?.name || 'Student'} · {formatRupees(proposal.proposedAmount)}</span><Badge status={proposal.status} /></li>)}</ul></div>}
      {gig.attachments?.length > 0 && <div className="admin-gig-image-list">{gig.attachments.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={'Gig image ' + (index + 1)} />Image {index + 1}</a>)}</div>}
      <div className="admin-record-actions"><Button to={'/gigs/' + gig._id} variant="secondary" size="small">Open gig details</Button><Button variant="secondary" size="small" onClick={() => onOpenChat(gig)}>View chat history</Button><Button variant={gig.isRemoved ? 'secondary' : 'danger-ghost'} size="small" loading={busy} onClick={() => onToggleRemoval(gig)}>{gig.isRemoved ? 'Restore listing visibility' : 'Remove from listings'}</Button><Button variant="danger-ghost" size="small" loading={busy} disabled={Boolean(deleteBlockReason)} title={deleteBlockReason || 'Permanently delete this gig and its uploaded images'} onClick={() => onDeleteGig(gig)}>Delete permanently</Button></div>
      {deleteBlockReason && <p className="subtle-note">Permanent deletion is unavailable: {deleteBlockReason}</p>}
    </article>
  )
}

function ProposalRecord({ proposal }) {
  return (
    <article className="admin-record-card admin-proposal-record">
      <div className="admin-record-heading"><div><p className="eyebrow">Applied {formatDateTime(proposal.createdAt)}</p><h3>{proposal.gig?.title || 'Gig no longer available'}</h3></div><Badge status={proposal.status} /></div>
      <div className="admin-record-details">
        <span><strong>Student</strong>{proposal.student?.name || 'Deleted account'}{proposal.student?.email ? ' · ' + proposal.student.email : ''}</span>
        <span><strong>Client</strong>{proposal.gig?.client?.name || 'Client unavailable'}</span>
        <span><strong>Project status</strong><Badge status={proposal.gig?.status || 'cancelled'} /></span>
        <span><strong>Offer</strong>{formatRupees(proposal.proposedAmount)} · {proposal.deliveryDays} days</span>
        {proposal.unappliedAt && <span><strong>Withdrawn at</strong>{formatDateTime(proposal.unappliedAt)}</span>}
      </div>
      {proposal.coverLetter && <p className="admin-cover-letter">{proposal.coverLetter}</p>}
    </article>
  )
}

function PaymentRecord({ payment, dispute = false, onHoldChange, onResolve, onApprove, onSaveRouteAccount, busy }) {
  const [routeAccountId, setRouteAccountId] = useState(payment.student?.razorpayAccountId || '')

  useEffect(() => {
    setRouteAccountId(payment.student?.razorpayAccountId || '')
  }, [payment.student?.razorpayAccountId])

  return (
    <article className="admin-record-card">
      <div className="admin-record-heading"><div><p className="eyebrow">Created {formatDateTime(payment.createdAt)}</p><h3>{payment.gig?.title || 'Gig payment'}</h3></div><Badge status={payment.status} /></div>
      <div className="admin-record-details">
        <span><strong>Client</strong>{payment.client?.name || 'Unavailable'}{payment.client?.email ? ' · ' + payment.client.email : ''}</span>
        <span><strong>Student</strong>{payment.student?.name || 'Unavailable'}{payment.student?.email ? ' · ' + payment.student.email : ''}</span>
        <span><strong>Total / platform fee</strong>{formatRupees(payment.totalAmount)} / {formatRupees(payment.platformFee)}</span>
        <span><strong>Student amount</strong>{formatRupees(payment.studentAmount)}</span>
        <span><strong>Payment mode</strong>{payment.mode === 'test' ? 'Test · simulated, no real money' : 'Live'}</span>
      </div>
      {payment.gig?.clientClosedAt && <p className="admin-cover-letter">Client closed this project on {formatDateTime(payment.gig.clientClosedAt)}. Review the submitted work before approving payout.</p>}
      {payment.gig?.submissionNote && <p className="admin-cover-letter">Student submission: {payment.gig.submissionNote}</p>}
      {payment.gig?.submissionLink && <p><a href={payment.gig.submissionLink} target="_blank" rel="noreferrer">Review submitted work <ExternalLink size={14} /></a></p>}
      {payment.mode !== 'test' && payment.student?._id && <div className="admin-route-account-form"><label htmlFor={'route-account-' + payment._id}>Student Razorpay Route linked-account ID</label><div><input id={'route-account-' + payment._id} className="field-input" value={routeAccountId} onChange={(event) => setRouteAccountId(event.target.value)} placeholder="acc_…" /><Button size="small" variant="secondary" loading={busy} disabled={!routeAccountId.trim() || routeAccountId.trim() === payment.student.razorpayAccountId} onClick={() => onSaveRouteAccount(payment, routeAccountId)}>Save account ID</Button></div><p>Use the ID Razorpay gives after the student is onboarded as a Route linked account. Do not enter raw bank or UPI details here.</p></div>}
      {dispute && payment.gig?.disputeReason && <p className="admin-cover-letter">Dispute: {payment.gig.disputeReason}</p>}
      {payment.adminHold && <p className="admin-hold-notice"><strong>Admin payment hold</strong>{payment.adminHoldReason || 'Reason not recorded'}{payment.adminHeldAt && <span>Placed {formatDateTime(payment.adminHeldAt)}</span>}</p>}
      {['paid', 'escrowed', 'disputed'].includes(payment.status) && <div className="admin-record-actions"><Button variant={payment.adminHold ? 'secondary' : 'danger-ghost'} size="small" loading={busy} onClick={() => onHoldChange(payment)}>{payment.adminHold ? 'Clear payment hold' : 'Place payment hold'}</Button></div>}
      {!dispute && payment.gig?.status === 'pending-admin-approval' && ['paid', 'escrowed'].includes(payment.status) && !payment.adminHold && <div className="admin-record-actions"><Button size="small" loading={busy} onClick={() => onApprove(payment)}>Approve 90% student payout</Button></div>}
      {dispute && <div className="admin-record-actions"><Button size="small" loading={busy} onClick={() => onResolve(payment, 'release')}>Resolve · release to student</Button><Button variant="danger-ghost" size="small" loading={busy} onClick={() => onResolve(payment, 'refund')}>Resolve · refund client</Button></div>}
    </article>
  )
}

function ReviewRecord({ review, onDelete, busy }) {
  return <article className="admin-record-card"><div className="admin-record-heading"><div><p className="eyebrow">Submitted {formatDateTime(review.createdAt)} · {review.gig?.title || 'Gig review'}</p><h3>{review.rating} / 5 stars · {review.reviewee?.name || 'User unavailable'}</h3></div><span className="admin-review-rating">★ {review.rating}</span></div><div className="admin-record-details"><span><strong>Reviewer</strong>{review.reviewer?.name || 'Unavailable'}{review.reviewer?.email ? ' · ' + review.reviewer.email : ''}</span><span><strong>Reviewed member</strong>{review.reviewee?.name || 'Unavailable'}{review.reviewee?.email ? ' · ' + review.reviewee.email : ''}</span></div>{review.comment && <p className="admin-cover-letter">{review.comment}</p>}<div className="admin-record-actions"><Button variant="danger-ghost" size="small" disabled={busy} onClick={() => onDelete(review)}>Remove review</Button></div></article>
}

function StudentChatRecord({ conversation, onStatus, onOpen, busy }) {
  const members = conversation.members || []
  return <article className="admin-record-card"><div className="admin-record-heading"><div><p className="eyebrow">Student-to-student request · {formatDateTime(conversation.createdAt)}</p><h3>{members.map((member) => '@' + (member.username || member.name || 'student')).join(' ↔ ')}</h3></div><Badge status={conversation.status} /></div>
    <div className="admin-record-details"><span><strong>Requested by</strong>@{conversation.requester?.username || conversation.requester?.name || 'student'}</span><span><strong>Sent to</strong>@{conversation.recipient?.username || conversation.recipient?.name || 'student'}</span><span><strong>Last activity</strong>{formatDateTime(conversation.updatedAt)}</span></div>
    <div className="admin-record-actions"><Button size="small" variant="secondary" onClick={() => onOpen(conversation)}>Review chat</Button>
      {conversation.status !== 'accepted' && <Button size="small" onClick={() => onStatus(conversation, 'accepted')} loading={busy}>Allow chat</Button>}
      {conversation.status !== 'blocked' && <Button size="small" variant="danger-ghost" onClick={() => onStatus(conversation, 'blocked')} loading={busy}>Block chat</Button>}
      {conversation.status === 'blocked' && <Button size="small" variant="secondary" onClick={() => onStatus(conversation, 'rejected')} loading={busy}>Unblock · keep closed</Button>}
    </div>
  </article>
}

function userDraftFrom(user) {
  return {
    name: user.name || '', email: user.email || '', username: user.username || '', role: user.role || 'student',
    college: user.college || '', companyName: user.companyName || '', whatsappNumber: user.whatsappNumber || '', bio: user.bio || '',
    skills: (user.skills || []).join(', '), portfolioLink: user.portfolioLink || '', profilePhoto: user.profilePhoto || '',
    portfolio: (user.portfolio || []).join('\n'), isVerified: Boolean(user.isVerified),
    socialLinks: { github: user.socialLinks?.github || '', linkedin: user.socialLinks?.linkedin || '', instagram: user.socialLinks?.instagram || '', discord: user.socialLinks?.discord || '' }
  }
}

function AdminProfileInput({ label, value, onChange, multiline = false, ...props }) {
  const Component = multiline ? 'textarea' : 'input'
  return <label className="profile-input-field"><span>{label}</span><Component value={value} onChange={onChange} {...props} /></label>
}

function AdminUserCard({ user, currentAdminId, onSave, onSuspend, onRemove, onLoadHistory, busy }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => userDraftFrom(user))
  const [history, setHistory] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  useEffect(() => setDraft(userDraftFrom(user)), [user])
  const isCurrentAdmin = String(user._id) === String(currentAdminId)
  const status = user.isRemoved ? 'removed' : user.isSuspended ? 'suspended' : 'active'

  function update(event) {
    const { name, value, checked, type } = event.target
    if (name.startsWith('socialLinks.')) {
      const key = name.split('.')[1]
      setDraft((current) => ({ ...current, socialLinks: { ...current.socialLinks, [key]: value } }))
      return
    }
    setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function save(event) {
    event.preventDefault()
    const saved = await onSave(user._id, {
      ...draft,
      skills: draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      portfolio: draft.portfolio.split('\n').map((url) => url.trim()).filter(Boolean)
    })
    if (saved) setEditing(false)
  }

  async function toggleHistory() {
    if (history) { setHistoryOpen((open) => !open); return }
    setHistoryLoading(true)
    const result = await onLoadHistory(user._id)
    if (result) { setHistory(result); setHistoryOpen(true) }
    setHistoryLoading(false)
  }

  return (
    <article className="admin-record-card admin-user-card">
      <div className="admin-record-heading"><div><p className="eyebrow">Joined {formatDate(user.createdAt)} · {user.username ? '@' + user.username : 'No username'}</p><h3>{user.name || 'Unnamed account'}</h3><p className="admin-user-email">{user.email}</p></div><div className="admin-user-badges"><Badge status={user.role} /><span className={'admin-account-state ' + status}>{status}</span></div></div>
      <div className="admin-record-details admin-user-details"><span><strong>College / organization</strong>{user.companyName || user.college || 'Not provided'}</span><span><strong>WhatsApp</strong>{user.whatsappNumber || 'Not provided'}</span><span><strong>Rating</strong>{user.rating || 0} · {user.totalReviews || 0} reviews</span><span><strong>Verification</strong>{user.isVerified ? 'Verified' : 'Not verified'}</span><span><strong>About</strong>{user.bio || 'Not provided'}</span><span><strong>Portfolio</strong>{user.portfolioLink || `${user.portfolio?.length || 0} uploaded item(s)`}</span></div>
      {(user.profilePhoto || Object.values(user.socialLinks || {}).some(Boolean) || user.portfolio?.length > 0) && <div className="admin-profile-preview">
        {user.profilePhoto && <img src={user.profilePhoto} alt="User profile" />}
        <div>{Object.entries(user.socialLinks || {}).filter(([, url]) => url).map(([network, url]) => <a key={network} href={url} target="_blank" rel="noreferrer">{network}</a>)}{user.portfolioLink && <a href={user.portfolioLink} target="_blank" rel="noreferrer">Portfolio link</a>}
          {user.portfolio?.length > 0 && <div className="admin-portfolio-preview">{user.portfolio.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">Uploaded portfolio {index + 1}</a>)}</div>}
        </div>
      </div>}
      {editing && !user.isRemoved && <form className="admin-user-edit-form" onSubmit={save}>
        <div className="admin-user-edit-grid">
          <AdminProfileInput label="Name" name="name" value={draft.name} onChange={update} required minLength="2" maxLength="120" />
          <AdminProfileInput label="Email" type="email" name="email" value={draft.email} onChange={update} required />
          <AdminProfileInput label="Username" name="username" value={draft.username} onChange={update} required minLength="3" maxLength="24" />
          <label className="profile-input-field"><span>Account role</span><select name="role" value={draft.role} onChange={update} disabled={isCurrentAdmin}><option value="student">Student</option><option value="client">Client</option><option value="admin">Admin</option></select></label>
          <AdminProfileInput label="College / organization" name="college" value={draft.college} onChange={update} maxLength="160" />
          <AdminProfileInput label="Company / organization name" name="companyName" value={draft.companyName} onChange={update} maxLength="160" />
          <AdminProfileInput label="WhatsApp number" name="whatsappNumber" value={draft.whatsappNumber} onChange={update} maxLength="30" />
          <AdminProfileInput label="Skills (comma separated)" name="skills" value={draft.skills} onChange={update} />
          <AdminProfileInput label="Portfolio link" name="portfolioLink" value={draft.portfolioLink} onChange={update} />
          <AdminProfileInput label="Profile photo URL" name="profilePhoto" value={draft.profilePhoto} onChange={update} />
          <AdminProfileInput label="About" name="bio" value={draft.bio} onChange={update} multiline rows="3" maxLength="500" />
          <AdminProfileInput label="Uploaded portfolio URLs (one per line)" name="portfolio" value={draft.portfolio} onChange={update} multiline rows="3" />
        </div>
        <div className="profile-social-fields admin-social-fields">{['github', 'linkedin', 'instagram', 'discord'].map((key) => <AdminProfileInput key={key} label={key} name={'socialLinks.' + key} value={draft.socialLinks[key]} onChange={update} />)}</div>
        <label className="admin-verified-toggle"><input type="checkbox" name="isVerified" checked={draft.isVerified} onChange={update} /> Mark profile as verified</label>
        <p className="subtle-note">Passwords and password hashes are never shown or editable here. Passwords must be changed through the account recovery flow.</p>
        <div className="admin-record-actions"><Button type="submit" loading={busy}>Save profile changes</Button><Button variant="secondary" onClick={() => { setEditing(false); setDraft(userDraftFrom(user)) }}>Cancel</Button></div>
      </form>}
      <div className="admin-record-actions">
        <Button variant="secondary" size="small" disabled={historyLoading} onClick={toggleHistory}>{historyLoading ? 'Loading account history…' : historyOpen ? 'Hide account history' : 'View account history'}</Button>
        {!user.isRemoved && <><Button variant="secondary" size="small" disabled={busy} onClick={() => setEditing((current) => !current)}><UserRoundCog size={14} /> {editing ? 'Close editor' : 'Edit profile'}</Button><Button variant="secondary" size="small" disabled={busy || isCurrentAdmin} onClick={() => onSuspend(user, !user.isSuspended)}>{user.isSuspended ? 'Restore access' : 'Suspend account'}</Button><Button variant="danger-ghost" size="small" disabled={busy || isCurrentAdmin} onClick={() => onRemove(user)}>Remove account</Button></>}
        {user.isRemoved && <span className="admin-user-removed-note">Account removed · historic gig and payment records retained</span>}
      </div>
      {historyOpen && history && <section className="admin-user-history"><h4>Account history · {history.user?.username ? '@' + history.user.username : history.user?.name}</h4>
        <div><strong>Gigs posted ({history.postedGigs?.length || 0})</strong>{history.postedGigs?.length ? <ul>{history.postedGigs.map((gig) => <li key={gig._id}>{gig.title} · {gig.status}{gig.isRemoved ? ' · removed' : ''}</li>)}</ul> : <p>No gigs posted.</p>}</div>
        <div><strong>Applications ({history.proposals?.length || 0})</strong>{history.proposals?.length ? <ul>{history.proposals.map((proposal) => <li key={proposal._id}>{proposal.gig?.title || 'Gig unavailable'} · {proposal.status}{proposal.gig?.isRemoved ? ' · removed' : ''}</li>)}</ul> : <p>No applications found.</p>}</div>
        <div><strong>Assigned work ({history.assignedGigs?.length || 0})</strong>{history.assignedGigs?.length ? <ul>{history.assignedGigs.map((gig) => <li key={gig._id}>{gig.title} · {gig.status}{gig.isRemoved ? ' · removed' : ''}</li>)}</ul> : <p>No assigned gigs.</p>}</div>
        <div><strong>Payments ({history.payments?.length || 0})</strong>{history.payments?.length ? <ul>{history.payments.map((payment) => <li key={payment._id}>{payment.gig?.title || 'Gig'} · {payment.status} · {formatRupees(payment.totalAmount)} · {payment.mode === 'test' ? 'test simulation' : 'live'}</li>)}</ul> : <p>No payment records.</p>}</div>
      </section>}
    </article>
  )
}

export default function AdminDashboardPage() {
  const { user: currentAdmin } = useAuth()
  const { showToast } = useToast()
  const [dashboard, setDashboard] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  const [view, setView] = useState('gigs')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [userRole, setUserRole] = useState('all')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [busyAction, setBusyAction] = useState('')
  const [activeChatGig, setActiveChatGig] = useState(null)
  const [activeStudentChat, setActiveStudentChat] = useState(null)
  const limit = 20

  useEffect(() => {
    let active = true
    apiClient.get('/admin/dashboard')
      .then(({ data }) => { if (active) setDashboard(data) })
      .catch((requestError) => { if (active) setDashboardError(getErrorMessage(requestError, 'Could not load admin summary.')) })
    return () => { active = false }
  }, [refreshVersion])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    let endpoint = '/admin/gigs'
    if (view === 'users') {
      if (status !== 'all') params.set('status', status)
      if (userRole !== 'all') params.set('role', userRole)
      if (search) params.set('search', search)
      endpoint = '/admin/users?' + params.toString()
    } else if (view === 'gigs') {
      if (status !== 'all') params.set('status', status)
      if (search) params.set('search', search)
      endpoint += '?' + params.toString()
    } else if (view === 'proposals') {
      if (status !== 'all') params.set('status', status)
      endpoint = '/admin/proposals?' + params.toString()
    } else if (view === 'payments') {
      if (status !== 'all') params.set('status', status)
      endpoint = '/admin/payments?' + params.toString()
    } else if (view === 'studentChats') {
      if (status !== 'all') params.set('status', status)
      endpoint = '/admin/student-chats?' + params.toString()
    } else if (view === 'reviews') {
      endpoint = '/admin/reviews?' + params.toString()
    } else {
      endpoint = '/admin/disputes'
    }

    apiClient.get(endpoint)
      .then(({ data }) => {
        if (!active) return
        const key = view === 'users' ? 'users' : view === 'gigs' ? 'gigs' : view === 'proposals' ? 'proposals' : view === 'payments' ? 'payments' : view === 'reviews' ? 'reviews' : view === 'studentChats' ? 'conversations' : 'disputes'
        const list = Array.isArray(data?.[key]) ? data[key] : []
        setRecords(list)
        setTotal(Number.isFinite(data?.total) ? data.total : list.length)
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load admin records.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [view, page, status, search, userRole, refreshVersion])

  function changeView(nextView) {
    setView(nextView)
    setStatus('all')
    setUserRole('all')
    setPage(1)
  }

  function submitSearch(event) {
    event.preventDefault()
    setSearch(searchDraft.trim())
    setPage(1)
  }

  async function saveUserProfile(userId, profile) {
    setBusyAction('user-' + userId)
    try {
      await apiClient.put('/admin/users/' + userId, profile)
      showToast('User profile updated.')
      setRefreshVersion((value) => value + 1)
      return true
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not update this user profile.'), 'error')
      return false
    } finally { setBusyAction('') }
  }

  async function changeUserSuspension(user, suspended) {
    if (suspended && !window.confirm(`Suspend ${user.name}? They will lose access to GIG INDIA until an admin restores the account.`)) return
    setBusyAction('user-' + user._id)
    try {
      await apiClient.patch('/admin/users/' + user._id + '/suspension', { suspended })
      showToast(suspended ? 'Account suspended.' : 'Account access restored.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not update this account.'), 'error')
    } finally { setBusyAction('') }
  }

  async function removeUser(user) {
    const confirmed = window.confirm(`Remove ${user.name}'s account? Their profile details will be anonymized and access blocked. Gig, proposal, payment, and chat history will remain for platform records.`)
    if (!confirmed) return
    setBusyAction('user-' + user._id)
    try {
      await apiClient.delete('/admin/users/' + user._id)
      showToast('Account removed; historic records were preserved.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not remove this account.'), 'error')
    } finally { setBusyAction('') }
  }

  async function changePaymentHold(payment) {
    const held = !payment.adminHold
    let reason = ''
    if (held) {
      reason = window.prompt('Reason for placing this payment on hold (required):', '') || ''
      if (!reason.trim()) return
    } else if (!window.confirm('Clear this admin hold? The payout will still require client closure and admin approval.')) return
    setBusyAction('payment-' + payment._id)
    try {
      await apiClient.patch('/admin/payments/' + payment._id + '/hold', { held, reason })
      showToast(held ? 'Payment hold placed.' : 'Payment hold cleared.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not update this payment hold.'), 'error')
    } finally { setBusyAction('') }
  }

  async function approvePayout(payment) {
    const gigTitle = payment.gig?.title || 'this project'
    if (!window.confirm(`Approve the Razorpay transfer of ${formatRupees(payment.studentAmount)} to the selected student for “${gigTitle}”?`)) return
    setBusyAction('payment-' + payment._id)
    try {
      const { data } = await apiClient.post('/admin/payments/' + payment._id + '/approve')
      showToast(data.message || 'Payout approval submitted.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not approve this payout.'), 'error')
    } finally { setBusyAction('') }
  }

  async function saveRouteAccount(payment, accountId) {
    if (!payment.student?._id) return showToast('The student account is unavailable.', 'error')
    setBusyAction('payment-' + payment._id)
    try {
      await apiClient.patch('/admin/users/' + payment.student._id + '/razorpay-account', { razorpayAccountId: accountId.trim() })
      showToast('Student Razorpay Route account ID saved.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not save this Route account ID.'), 'error')
    } finally { setBusyAction('') }
  }

  async function resolveDispute(payment, resolution) {
    const gigId = payment.gig?._id
    if (!gigId) return showToast('The gig record is missing; this dispute cannot be resolved here.', 'error')
    const action = resolution === 'release' ? 'release the held funds to the student' : 'request a full refund for the client'
    if (!window.confirm(`Confirm you want to ${action}?`)) return
    const note = window.prompt(resolution === 'release' ? 'Resolution note (optional):' : 'Reason for refund (required):', '') || ''
    if (resolution === 'refund' && !note.trim()) return
    setBusyAction('payment-' + payment._id)
    try {
      await apiClient.post('/admin/disputes/' + gigId + '/resolve', { resolution, note })
      showToast(resolution === 'release' ? 'Dispute resolved; release requested.' : 'Dispute resolved; refund requested.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not resolve this dispute.'), 'error')
    } finally { setBusyAction('') }
  }

  async function deleteReview(review) {
    if (!window.confirm(`Remove this ${review.rating}-star review? The member's rating will be recalculated.`)) return
    setBusyAction('review-' + review._id)
    try {
      await apiClient.delete('/admin/reviews/' + review._id)
      showToast('Review removed and rating recalculated.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not remove this review.'), 'error')
    } finally { setBusyAction('') }
  }

  async function toggleGigRemoval(gig) {
    const removed = !gig.isRemoved
    const prompt = removed
      ? `Remove “${gig.title}” from public listings? Its history will stay available to the client, student, and admins. Any active escrow payment will be put on admin hold.`
      : `Restore “${gig.title}” to the marketplace if its status is still open?`
    if (!window.confirm(prompt)) return
    setBusyAction('gig-' + gig._id)
    try {
      const { data } = await apiClient.patch('/admin/gigs/' + gig._id + '/removal', { removed })
      showToast(data.message)
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not update this gig listing.'), 'error')
    } finally { setBusyAction('') }
  }

  async function deleteGig(gig) {
    if (!window.confirm(`Permanently delete “${gig.title}” and its uploaded images? This cannot be undone. Gigs with applications, chat, work, reviews, or payment history cannot be permanently deleted.`)) return
    setBusyAction('gig-' + gig._id)
    try {
      const { data } = await apiClient.delete('/admin/gigs/' + gig._id)
      showToast(data.message || 'Gig permanently deleted.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not permanently delete this gig.'), 'error')
    } finally { setBusyAction('') }
  }

  async function loadUserHistory(userId) {
    try {
      const { data } = await apiClient.get('/admin/users/' + userId + '/history')
      return data
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not load this account history.'), 'error')
      return null
    }
  }

  async function changeStudentChatStatus(conversation, nextStatus) {
    const message = nextStatus === 'blocked'
      ? 'Block this student chat? Participants will no longer be able to open or send messages.'
      : nextStatus === 'accepted'
        ? 'Allow this student chat? Both students will be able to use it.'
        : 'Close this chat request without accepting it?'
    if (!window.confirm(message)) return
    setBusyAction('student-chat-' + conversation._id)
    try {
      await apiClient.patch('/admin/student-chats/' + conversation._id + '/status', { status: nextStatus })
      showToast('Student chat status updated.')
      setRefreshVersion((value) => value + 1)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not update this student chat.'), 'error')
    } finally { setBusyAction('') }
  }

  const statusCounts = dashboard?.gigs?.byStatus || {}
  const statusOptions = view === 'users' ? ['active', 'suspended', 'removed'] : view === 'studentChats' ? ['pending', 'accepted', 'rejected', 'blocked'] : view === 'proposals' ? ['pending', 'accepted', 'rejected', 'withdrawn'] : view === 'payments' ? ['created', 'paid', 'escrowed', 'releasing', 'refunding', 'released', 'refunded', 'disputed'] : view === 'gigs' ? ['open', 'in-progress', 'submitted', 'pending-admin-approval', 'payout-processing', 'completed', 'disputed', 'cancelled', 'removed'] : ['open', 'in-progress', 'submitted', 'pending-admin-approval', 'payout-processing', 'completed', 'disputed', 'cancelled']
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="content-page admin-page">
      <PageHeading eyebrow="Platform operations" title="GIG INDIA admin" description="Manage member access and profiles, review gig and student chat, remove listings, and supervise payment holds and disputes." />
      {dashboardError ? <ErrorState message={dashboardError} /> : !dashboard ? <LoadingState message="Loading platform summary..." /> : (
        <section className="admin-summary-grid" aria-label="Platform summary">
          <SummaryCard label="All users" value={dashboard.users.total} />
          <SummaryCard label="Students" value={dashboard.users.students} tone="summary-yellow" />
          <SummaryCard label="Clients" value={dashboard.users.clients} />
          <SummaryCard label="All gigs" value={dashboard.gigs.total} tone="summary-violet" />
          <SummaryCard label="Open disputes" value={dashboard.gigs.disputed} tone="summary-pink" />
        </section>
      )}

      <section className="admin-workspace">
        <div className="admin-toolbar">
          <div className="admin-tabs" role="tablist" aria-label="Admin records">
            {views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} className={'admin-tab' + (view === item.id ? ' admin-tab-active' : '')} onClick={() => changeView(item.id)}>{item.label}</button>)}
          </div>
          {['users', 'gigs', 'proposals', 'payments', 'studentChats'].includes(view) && <div className="admin-filters">
            {(view === 'gigs' || view === 'users') && <form className="admin-search" onSubmit={submitSearch}><Search size={16} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={view === 'users' ? 'Search name, email, username' : 'Search gig title'} aria-label={view === 'users' ? 'Search users' : 'Search gig title'} /><Button type="submit" size="small">Search</Button></form>}
            {view === 'users' && <label className="admin-status-filter"><span className="sr-only">Filter role</span><select value={userRole} onChange={(event) => { setUserRole(event.target.value); setPage(1) }}><option value="all">All roles</option><option value="student">Students</option><option value="client">Clients</option><option value="admin">Admins</option></select></label>}
            <label className="admin-status-filter"><span className="sr-only">Filter status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">{view === 'users' ? 'All account states' : 'All statuses'}</option>{statusOptions.map((item) => <option value={item} key={item}>{item.replaceAll('-', ' ')}</option>)}</select></label>
          </div>}
        </div>

        {view === 'gigs' && <div className="admin-status-counts">{['open', 'in-progress', 'submitted', 'pending-admin-approval', 'payout-processing', 'completed', 'disputed', 'cancelled'].map((item) => <span key={item}><Badge status={item} /> {statusCounts[item] || 0}</span>)}</div>}

        {loading ? <LoadingState message={'Loading ' + (views.find((item) => item.id === view)?.label.toLowerCase() || 'records') + '...'} /> : error ? <ErrorState message={error} /> : records.length === 0 ? <EmptyState title="No records found" message={view === 'disputes' ? 'There are no payment disputes to review right now.' : 'No records match the selected filter.'} /> : (
          <div className="admin-record-list">
            {view === 'users' && records.map((user) => <AdminUserCard key={user._id} user={user} currentAdminId={currentAdmin?._id} onSave={saveUserProfile} onSuspend={changeUserSuspension} onRemove={removeUser} onLoadHistory={loadUserHistory} busy={busyAction === 'user-' + user._id} />)}
            {view === 'gigs' && records.map((gig) => <AdminGigCard key={gig._id} gig={gig} onOpenChat={setActiveChatGig} onToggleRemoval={toggleGigRemoval} onDeleteGig={deleteGig} busy={busyAction === 'gig-' + gig._id} />)}
            {view === 'proposals' && records.map((proposal) => <ProposalRecord key={proposal._id} proposal={proposal} />)}
            {view === 'payments' && records.map((payment) => <PaymentRecord key={payment._id} payment={payment} onHoldChange={changePaymentHold} onApprove={approvePayout} onSaveRouteAccount={saveRouteAccount} busy={busyAction === 'payment-' + payment._id} />)}
            {view === 'disputes' && records.map((payment) => <PaymentRecord key={payment._id} payment={payment} dispute onHoldChange={changePaymentHold} onSaveRouteAccount={saveRouteAccount} busy={busyAction === 'payment-' + payment._id} />)}
            {view === 'reviews' && records.map((review) => <ReviewRecord key={review._id} review={review} onDelete={deleteReview} busy={busyAction === 'review-' + review._id} />)}
            {view === 'studentChats' && records.map((conversation) => <StudentChatRecord key={conversation._id} conversation={conversation} onStatus={changeStudentChatStatus} onOpen={setActiveStudentChat} busy={busyAction === 'student-chat-' + conversation._id} />)}
          </div>
        )}

        {!loading && !error && view !== 'disputes' && total > limit && <div className="admin-pagination"><span>Page {page} of {pageCount} · {total} records</span><div><Button variant="secondary" size="small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="secondary" size="small" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}
      </section>
      <p className="subtle-note admin-note"><ShieldCheck size={16} /> Admin access is checked by the backend. Removed gig listings and accounts retain their history for review. Admins can inspect gig and student-to-student chats, block student chats, and hold payments.</p>
      {activeChatGig && <AdminChatViewer gig={activeChatGig} onClose={() => setActiveChatGig(null)} />}
      {activeStudentChat && <AdminStudentChatViewer conversation={activeStudentChat} onClose={() => setActiveStudentChat(null)} />}
    </div>
  )
}
