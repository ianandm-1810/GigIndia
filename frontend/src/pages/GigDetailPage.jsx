import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, MessageCircle, Send, Trash2 } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState({ coverLetter: '', proposedAmount: '', deliveryDays: '' })
  const proposals = proposalState.gigId === gigId ? proposalState.items : []
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
    let active = true
    if (!isOwner) return () => { active = false }
    apiClient.get('/proposals/' + gigId)
      .then(({ data }) => { if (active) setProposalState({ gigId, items: Array.isArray(data) ? data : [] }) })
      .catch(() => { if (active) setProposalState({ gigId, items: [] }) })
    return () => { active = false }
  }, [gigId, isOwner])

  async function submitProposal(event) {
    event.preventDefault()
    if (!user) return navigate('/login', { state: { from: '/gigs/' + gigId } })
    setBusy(true)
    try {
      await apiClient.post('/proposals/' + gigId, { ...proposal, proposedAmount: Number(proposal.proposedAmount), deliveryDays: Number(proposal.deliveryDays) })
      showToast('Proposal sent. The client can now review it.')
      setProposal({ coverLetter: '', proposedAmount: '', deliveryDays: '' })
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not send your proposal.'), 'error')
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
    if (!window.confirm('Delete this gig? This action cannot be undone.')) return
    setBusy(true)
    try {
      await apiClient.delete('/gigs/' + gigId)
      showToast('Gig deleted.')
      navigate('/client')
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Could not delete this gig.'), 'error')
    } finally { setBusy(false) }
  }

  if (loading || loadedGigId !== gigId) return <div className="content-page"><LoadingState message="Loading gig details..." /></div>
  if (error || !gig) return <div className="content-page"><ErrorState message={error || 'Gig not found.'} action={<Button to="/browse-gigs" variant="secondary">Browse gigs</Button>} /></div>

  const assignedStudentId = getId(gig.assignedTo)
  const canChat = user && (isOwner || assignedStudentId === user._id) && Boolean(assignedStudentId)
  const studentCanPropose = user?.role === 'student' && !isOwner && gig.status === 'open'

  return (
    <div className="content-page">
      <Link className="back-link" to="/browse-gigs"><ArrowLeft size={16} /> Back to gigs</Link>
      <div className="gig-detail-grid">
        <article className="gig-detail-main">
          <div className="gig-detail-top"><span className="category-chip">{gig.category?.replaceAll('-', ' ')}</span><Badge status={gig.status} /></div>
          <PageHeading title={gig.title} description={gig.description} />
          <div className="gig-detail-meta"><div><span>Budget</span><strong>{formatRupees(gig.budget)}</strong></div><div><span>Deadline</span><strong><CalendarDays size={16} />{formatDate(gig.deadline)}</strong></div><div><span>Posted by</span><strong>{gig.client?.name || 'GIGI India client'}</strong></div></div>
          {gig.client?.college && <p className="college-line">{gig.client.college}</p>}
          {canChat && <Button to={'/chat/' + gig._id} variant="secondary"><MessageCircle size={17} /> Open project chat</Button>}
          {isOwner && gig.status === 'open' && <Button variant="danger-ghost" onClick={deleteGig} loading={busy}><Trash2 size={16} /> Delete gig</Button>}
          {gig.assignedTo && <section className="assignment-banner"><div><p className="eyebrow">Selected student</p><strong>{gig.assignedTo.name || 'Assigned student'}</strong></div><Badge status={gig.status} /></section>}
          {isOwner && gig.assignedTo && gig.paymentStatus === 'pending' && <Card className="payment-card"><p className="eyebrow">Payment setup</p><h2>Record project payment</h2><PaymentCheckout gig={gig} onPaymentVerified={loadGig} /></Card>}
          {isOwner && gig.paymentStatus === 'escrowed' && <div className="notice-card"><h2>Payment verified</h2><p>The backend has recorded payment status. Student payout and automated release are not connected yet; do not treat this as a completed payout.</p></div>}
          {isOwner && <section className="proposal-section"><PageHeading eyebrow="Client review" title="Proposals" description="Review a student's approach, price, and delivery estimate." />{proposals.length === 0 ? <EmptyState title="No proposals yet" message="When a student applies to this gig, their proposal will appear here." /> : <div className="proposal-list">{proposals.map((item) => <Card className="proposal-card" key={item._id}><div className="proposal-card-head"><div><h3>{item.student?.name || 'Student'}</h3><p>{item.student?.college || 'College not provided'}</p></div><Badge status={item.status} /></div><p>{item.coverLetter}</p><div className="proposal-meta"><strong>{formatRupees(item.proposedAmount)}</strong><span>{item.deliveryDays} days</span></div>{gig.status === 'open' && item.status === 'pending' && <Button onClick={() => acceptProposal(item._id)} loading={busy}>Accept proposal</Button>}</Card>)}</div>}</section>}
        </article>
        <aside className="gig-detail-aside">
          {studentCanPropose ? <Card className="proposal-form-card"><p className="eyebrow">Interested in this project?</p><h2>Send a proposal</h2><p>Tell the client what you would do and how long it will take.</p><form className="form-stack" onSubmit={submitProposal}><div className="form-field"><label className="field-label" htmlFor="proposal-cover">Cover letter</label><textarea className="field-input field-textarea" id="proposal-cover" rows="5" maxLength="1000" value={proposal.coverLetter} onChange={(event) => setProposal((current) => ({ ...current, coverLetter: event.target.value }))} placeholder="Briefly describe your approach and relevant skills." required /></div><Field label="Your price (₹)" id="proposal-amount" type="number" min="100" step="1" value={proposal.proposedAmount} onChange={(event) => setProposal((current) => ({ ...current, proposedAmount: event.target.value }))} required /><Field label="Delivery time (days)" id="proposal-days" type="number" min="1" step="1" value={proposal.deliveryDays} onChange={(event) => setProposal((current) => ({ ...current, deliveryDays: event.target.value }))} required /><Button type="submit" loading={busy}><Send size={16} /> Send proposal</Button></form></Card> : <Card className="gig-aside-note"><p className="eyebrow">Good to know</p><h2>Review the scope first.</h2><p>Check the deadline, budget, and expected outcome. Only apply if you can deliver the work.</p>{!user && <Button to="/login" variant="secondary">Log in to propose</Button>}</Card>}
          <div className="notice-card notice-compact"><strong>Payment status note</strong><p>The current build records checkout verification. It does not yet transfer money to a student or automatically release funds.</p></div>
        </aside>
      </div>
    </div>
  )
}
