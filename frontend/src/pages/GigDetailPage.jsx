import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, ExternalLink, MessageCircle, Send, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import Field from '../components/common/Field.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import PaymentCheckout from '../components/features/PaymentCheckout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDate, formatRupees, getId } from '../utils/format.js'

export default function GigDetailPage() {
  const { gigId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [gig, setGig] = useState(null)
  const [loadedGigId, setLoadedGigId] = useState('')
  const [proposalState, setProposalState] = useState({ gigId: '', items: [] })
  const [myProposalState, setMyProposalState] = useState({ gigId: '', proposal: null })
  const [checkingProposal, setCheckingProposal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState({ coverLetter: '', proposedAmount: '', deliveryDays: '' })
  const [submission, setSubmission] = useState(null)
  const [submissionForm, setSubmissionForm] = useState({ note: '', link: '' })
  const proposals = proposalState.gigId === gigId ? proposalState.items : []
  const myProposal = myProposalState.gigId === gigId ? myProposalState.proposal : null
  const isOwner = Boolean(loadedGigId === gigId && gig && user && getId(gig.client) === user._id)

  const fetchGig = useCallback(async () => {
    const { data } = await apiClient.get('/gigs/' + gigId)
    return data
  }, [gigId])

  const loadGig = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const data = await fetchGig()
      setGig(data)
      setLoadedGigId(gigId)
      setError('')
      return data
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'We could not load this gig.'))
      setLoadedGigId(gigId)
      return null
    } finally { setLoading(false) }
  }, [fetchGig, gigId])

  useEffect(() => {
    let active = true
    fetchGig()
      .then((data) => {
        if (!active) return
        setGig(data)
        setLoadedGigId(gigId)
        setError('')
      })
      .catch((requestError) => {
        if (!active) return
        setError(getErrorMessage(requestError, 'We could not load this gig.'))
        setLoadedGigId(gigId)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fetchGig, gigId])

  useEffect(() => {
    if (!['submitted', 'pending-admin-approval', 'payout-processing', 'completed', 'disputed'].includes(gig?.status)) return undefined
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadGig({ showLoading: false })
    }
    const timer = window.setInterval(refreshWhenVisible, 30 * 1000)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [gig?.status, loadGig])

  useEffect(() => {
    const isParticipant = Boolean(user && (isOwner || getId(gig?.assignedTo) === user._id || user.role === 'admin'))
    if (!isParticipant || !['submitted', 'pending-admin-approval', 'payout-processing', 'completed', 'disputed'].includes(gig?.status)) {
      setSubmission(null)
      return undefined
    }

    let active = true
    apiClient.get('/gigs/' + gigId + '/submission')
      .then(({ data }) => { if (active) setSubmission(data) })
      .catch(() => { if (active) setSubmission(null) })
    return () => { active = false }
  }, [gig?.status, gig?.paymentStatus, gig?.assignedTo, gigId, isOwner, user?._id, user?.role])

  useEffect(() => {
    let active = true
    if (!isOwner) return () => { active = false }
    apiClient.get('/proposals/' + gigId)
      .then(({ data }) => { if (active) setProposalState({ gigId, items: Array.isArray(data) ? data : [] }) })
      .catch(() => { if (active) setProposalState({ gigId, items: [] }) })
    return () => { active = false }
  }, [gigId, isOwner])

  useEffect(() => {
    let active = true
    if (user?.role !== 'student' || isOwner || loadedGigId !== gigId) {
      setMyProposalState({ gigId, proposal: null })
      setCheckingProposal(false)
      return () => { active = false }
    }
    setCheckingProposal(true)
    apiClient.get('/proposals/my/' + gigId).then(({ data }) => {
      if (!active) return
      setMyProposalState({ gigId, proposal: data.proposal || null })
    }).catch(() => {
      if (active) setMyProposalState({ gigId, proposal: null })
    }).finally(() => { if (active) setCheckingProposal(false) })
    return () => { active = false }
  }, [gigId, isOwner, loadedGigId, user?.role])

  async function submitProposal(event) {
    event.preventDefault()
    if (!user) return navigate('/login', { state: { from: '/gigs/' + gigId } })
    setBusy(true)
    try {
      const { data } = await apiClient.post('/proposals/' + gigId, { ...proposal, proposedAmount: Number(proposal.proposedAmount), deliveryDays: Number(proposal.deliveryDays) })
      setMyProposalState({ gigId, proposal: data })
      showToast('Proposal sent. The client can now review it.')
      setProposal({ coverLetter: '', proposedAmount: '', deliveryDays: '' })
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not send your proposal.'), 'error')
    } finally { setBusy(false) }
  }

  async function unapply() {
    if (!myProposal) return
    setBusy(true)
    try {
      const { data } = await apiClient.delete('/proposals/' + myProposal._id)
      setMyProposalState({ gigId, proposal: data.proposal })
      showToast('Proposal withdrawn. It will stay in your application history as withdrawn.')
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not withdraw this proposal.'), 'error')
    } finally { setBusy(false) }
  }

  async function acceptProposal(proposalId) {
    setBusy(true)
    try {
      await apiClient.put('/proposals/' + proposalId + '/accept')
      showToast('Proposal accepted. Opening your private project chat.')
      navigate('/chat/' + gigId)
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not accept this proposal.'), 'error')
    } finally { setBusy(false) }
  }

  async function deleteGig() {
    if (!window.confirm('Withdraw this open listing? It will disappear from browse results, pending proposals will be declined, and the gig will stay in your history.')) return
    setBusy(true)
    try {
      await apiClient.delete('/gigs/' + gigId)
      showToast('Gig withdrawn. Its history has been preserved.')
      navigate('/client')
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not delete this gig.'), 'error')
    } finally { setBusy(false) }
  }

  async function submitWork(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await apiClient.post('/gigs/' + gigId + '/submit', {
        submissionNote: submissionForm.note,
        submissionLink: submissionForm.link,
        submissionAttachments: [],
      })
      showToast(data.message || 'Work submitted for client review.')
      setSubmissionForm({ note: '', link: '' })
      await loadGig({ showLoading: false })
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not submit this work.'), 'error')
    } finally { setBusy(false) }
  }

  async function closeProject() {
    if (!window.confirm('Close this project and send its payout to GIG INDIA admin for approval? The student payout will not be released until an admin approves it.')) return
    setBusy(true)
    try {
      const { data } = await apiClient.post('/payments/close/' + gigId)
      showToast(data.message || 'Project closed. Awaiting admin payout approval.')
      await loadGig({ showLoading: false })
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not close this project.'), 'error')
    } finally { setBusy(false) }
  }

  if (loading || loadedGigId !== gigId) return <div className="content-page"><LoadingState message="Loading gig details..." /></div>
  if (error || !gig) return <div className="content-page"><ErrorState message={error || 'Gig not found.'} action={<Button to="/browse-gigs" variant="secondary">Browse gigs</Button>} /></div>

  const assignedStudentId = getId(gig.assignedTo)
  const isAssignedStudent = user?.role === 'student' && assignedStudentId === user._id
  const canSubmitWork = user?.role === 'student' && gig.status === 'in-progress' && (isAssignedStudent || myProposal?.status === 'accepted')
  const canChat = user && (isOwner || assignedStudentId === user._id) && Boolean(assignedStudentId) && gig.chatAccess?.available
  const hasPendingProposal = myProposal?.status === 'pending'
  const studentCanPropose = user?.role === 'student' && !isOwner && gig.status === 'open' && !checkingProposal && (!myProposal || myProposal.status === 'withdrawn')

  return (
    <div className="content-page">
      <Link className="back-link" to="/browse-gigs"><ArrowLeft size={16} /> Back to gigs</Link>
      <div className="gig-detail-grid">
        <article className="gig-detail-main">
          <div className="gig-detail-top"><span className="category-chip">{gig.category?.replaceAll('-', ' ')}</span><Badge status={gig.status} /></div>
          {gig.status !== 'open' && <p className="gig-history-notice">This listing is available for reference only and is not accepting new proposals.</p>}
          <PageHeading title={gig.title} description={gig.description} />
          {gig.attachments?.length > 0 && <div className="gig-detail-image-grid" aria-label="Gig images">{gig.attachments.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={'Image for ' + gig.title} /></a>)}</div>}
          {(gig.client?.companyName || gig.client?.bio || Object.values(gig.client?.socialLinks || {}).some(Boolean)) && <section className="gig-client-profile"><p className="eyebrow">About the client</p><h2>{gig.client.companyName || gig.client.name}</h2>{gig.client.bio && <p>{gig.client.bio}</p>}<div>{Object.entries(gig.client.socialLinks || {}).filter(([, url]) => url).map(([network, url]) => <a key={network} href={url} target="_blank" rel="noreferrer">{network}</a>)}</div></section>}
          <div className="gig-detail-meta"><div><span>{gig.agreedAmount ? 'Agreed price' : 'Budget'}</span><strong>{formatRupees(gig.agreedAmount || gig.budget)}</strong></div><div><span>Deadline</span><strong><CalendarDays size={16} />{formatDate(gig.deadline)}</strong></div><div><span>Posted by</span><strong>{gig.client?.name || 'GIG INDIA client'}</strong></div></div>
          {gig.client?.college && <p className="college-line">{gig.client.college}</p>}
          {canChat && <Button to={'/chat/' + gig._id} variant="secondary"><MessageCircle size={17} /> Open project chat</Button>}
          {user && (isOwner || assignedStudentId === user._id) && gig.chatAccess?.expiresAt && <p className="client-chat-retention">The project chat retention period ends {formatDate(gig.chatAccess.expiresAt)}.</p>}
          {isOwner && gig.status === 'open' && <Button variant="danger-ghost" onClick={deleteGig} loading={busy}><Trash2 size={16} /> Withdraw listing</Button>}
          {gig.assignedTo && <section className="assignment-banner"><div><p className="eyebrow">Selected student</p><strong>{gig.assignedTo.name || 'Assigned student'}</strong>{isOwner && gig.assignedTo.username && <Link className="proposal-student-profile-link" to={'/students/' + encodeURIComponent(gig.assignedTo.username) + '?gigId=' + gigId}>View student profile</Link>}</div><Badge status={gig.status} /></section>}
          {canSubmitWork && <Card className="payment-card"><p className="eyebrow">Submit your delivery</p><h2>Send the work to your client</h2><p>Add a delivery link or a short note describing what is complete. The client will pay after reviewing your submission.</p><form className="form-stack" onSubmit={submitWork}><Field label="Delivery link (optional)" id="submission-link" type="url" value={submissionForm.link} onChange={(event) => setSubmissionForm((current) => ({ ...current, link: event.target.value }))} placeholder="https://…" /><div className="form-field"><label className="field-label" htmlFor="submission-note">What did you complete?</label><textarea className="field-input field-textarea" id="submission-note" rows="4" maxLength="2000" value={submissionForm.note} onChange={(event) => setSubmissionForm((current) => ({ ...current, note: event.target.value }))} placeholder="Summarize your delivery or add access instructions." /></div><Button type="submit" loading={busy} disabled={!submissionForm.note.trim() && !submissionForm.link.trim()}><Send size={16} /> Submit work</Button></form></Card>}
          {submission && <Card className="payment-card"><p className="eyebrow">Student delivery</p><h2>Submitted work</h2>{submission.submissionNote && <p>{submission.submissionNote}</p>}{submission.submissionLink && <p><a href={submission.submissionLink} target="_blank" rel="noreferrer">Open delivery link <ExternalLink size={15} /></a></p>}{submission.submissionAttachments?.map((url, index) => <p key={url}><a href={url} target="_blank" rel="noreferrer">Open attachment {index + 1} <ExternalLink size={15} /></a></p>)}</Card>}
          {isOwner && gig.status === 'submitted' && gig.paymentStatus === 'pending' && <Card className="payment-card"><p className="eyebrow">Client payment</p><h2>Pay for the submitted work</h2><p>Agreed project price: {formatRupees(gig.agreedAmount || gig.budget)}. The payment is collected by GIG INDIA. After you review and close the project, an admin can approve the student's 90% payout.</p><PaymentCheckout gig={gig} onPaymentVerified={() => loadGig({ showLoading: false })} /></Card>}
          {isOwner && gig.status === 'submitted' && ['paid', 'escrowed'].includes(gig.paymentStatus) && <Card className="payment-card"><p className="eyebrow">Payment received</p><h2>Review the submitted work</h2><p>Check the student's delivery description and link above. When the work is ready to close, send it to GIG INDIA admin for payout approval. The student receives 90%; GIG INDIA keeps the 10% platform fee.</p><Button onClick={closeProject} loading={busy}>Close project &amp; request payout approval</Button></Card>}
          {isOwner && gig.status === 'pending-admin-approval' && <div className="notice-card"><h2>Project closed · awaiting admin approval</h2><p>The client has reviewed and closed the project. GIG INDIA admin must approve the 90% student payout. The 10% platform fee is retained by GIG INDIA.</p></div>}
          {isOwner && gig.status === 'payout-processing' && <div className="notice-card"><h2>Razorpay is processing the payout</h2><p>GIG INDIA admin approved the student's 90% share. The project will show as completed when Razorpay confirms the transfer; the bank settlement schedule affects when funds appear.</p></div>}
          {isOwner && gig.status === 'completed' && gig.paymentStatus === 'released' && <div className="notice-card"><h2>Project completed</h2><p>Razorpay confirmed the student's 90% transfer. The transaction and completed gig remain in both users’ history.</p></div>}
          {isAssignedStudent && gig.status === 'submitted' && <div className="notice-card"><h2>Delivery submitted</h2><p>{['paid', 'escrowed'].includes(gig.paymentStatus) ? 'The client has paid and can review your delivery, then close the project for GIG INDIA admin payout approval.' : 'Your client can now review the delivery and pay for the project.'}</p></div>}
          {isAssignedStudent && gig.status === 'pending-admin-approval' && <div className="notice-card"><h2>Client closed the project</h2><p>Your 90% payout is awaiting GIG INDIA admin approval. The payment will appear in your transaction history.</p></div>}
          {isAssignedStudent && gig.status === 'payout-processing' && <div className="notice-card"><h2>Your payout is processing</h2><p>Admin approved the 90% payout. Razorpay is processing the transfer; the bank settlement schedule affects when it appears in your account.</p></div>}
          {isOwner && <section className="proposal-section"><PageHeading eyebrow="Client review" title="Proposals" description="Review a student's approach, price, and delivery estimate." />{proposals.length === 0 ? <EmptyState title="No proposals yet" message="When a student applies to this gig, their proposal will appear here." /> : <div className="proposal-list">{proposals.map((item) => <Card className="proposal-card" key={item._id}><div className="proposal-card-head"><div><h3>{item.student?.name || 'Student'}</h3><p>{item.student?.college || 'College not provided'}</p></div><Badge status={item.status} /></div><p>{item.coverLetter}</p><div className="proposal-meta"><strong>{formatRupees(item.proposedAmount)}</strong><span>{item.deliveryDays} days</span></div>{item.student?.username && item.status === 'accepted' && <Link className="proposal-student-profile-link" to={'/students/' + encodeURIComponent(item.student.username) + '?gigId=' + gigId}>View selected student's profile</Link>}{gig.status === 'open' && item.status === 'pending' && <Button onClick={() => acceptProposal(item._id)} loading={busy}>Accept proposal</Button>}</Card>)}</div>}</section>}
        </article>
        <aside className="gig-detail-aside">
          {checkingProposal ? <Card className="proposal-form-card"><p>Checking your application status…</p></Card> : hasPendingProposal ? <Card className="proposal-form-card"><p className="eyebrow">Application sent</p><h2>Your proposal is with the client</h2><p>The client can review your price, delivery estimate, and cover letter.</p><div className="unapply-window"><span>You can withdraw this application any time before the client approves it.</span><Button variant="danger-ghost" size="small" onClick={unapply} loading={busy}>Withdraw application</Button></div></Card> : studentCanPropose ? <Card className="proposal-form-card"><p className="eyebrow">Interested in this project?</p><h2>Send a proposal</h2><p>Tell the client what you would do and how long it will take.</p><form className="form-stack" onSubmit={submitProposal}><div className="form-field"><label className="field-label" htmlFor="proposal-cover">Cover letter</label><textarea className="field-input field-textarea" id="proposal-cover" rows="5" maxLength="1000" value={proposal.coverLetter} onChange={(event) => setProposal((current) => ({ ...current, coverLetter: event.target.value }))} placeholder="Briefly describe your approach and relevant skills." required /></div><Field label="Your price (₹)" id="proposal-amount" type="number" min="100" step="1" value={proposal.proposedAmount} onChange={(event) => setProposal((current) => ({ ...current, proposedAmount: event.target.value }))} required /><Field label="Delivery time (days)" id="proposal-days" type="number" min="1" step="1" value={proposal.deliveryDays} onChange={(event) => setProposal((current) => ({ ...current, deliveryDays: event.target.value }))} required /><Button type="submit" loading={busy}><Send size={16} /> Send proposal</Button></form></Card> : <Card className="gig-aside-note"><p className="eyebrow">Good to know</p><h2>Review the scope first.</h2><p>Check the deadline, budget, and expected outcome. Only apply if you can deliver the work.</p>{myProposal?.status === 'withdrawn' && <p>Your previous proposal was withdrawn. You may submit a new one while this gig remains open.</p>}{myProposal?.status === 'rejected' && <p>The client declined your earlier proposal. You cannot send another proposal for this gig.</p>}{!user && <Button to="/login" variant="secondary">Log in to propose</Button>}</Card>}
          {gig.assignedTo && <div className="notice-card notice-compact"><strong>Payment flow</strong><p>Student submits work → client pays and reviews it → client closes project → admin approves the 90% student payout. GIG INDIA retains 10%.</p></div>}
        </aside>
      </div>
    </div>
  )
}
