import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleDollarSign, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import apiClient from '../../services/apiClient.js'
import { getErrorMessage } from '../../utils/errors.js'
import { formatDate, formatRupees } from '../../utils/format.js'
import { EmptyState, ErrorState, LoadingState } from '../common/StateMessage.jsx'

const statusCopy = (payment) => {
  if (payment.mode === 'test') {
    if (payment.status === 'released') return 'Test payout recorded · no money moved'
    if (payment.status === 'escrowed') return 'Test payment held · payout is simulated'
    if (payment.status === 'paid') return 'Test payment recorded · no money moved; awaiting closure'
  }
  return ({
    created: 'Checkout started',
    paid: payment.clientClosedAt ? 'Client closed · awaiting admin payout approval' : 'Payment received · awaiting client closure',
    escrowed: payment.clientClosedAt ? 'Client closed · awaiting admin payout approval' : 'Payment received · awaiting client closure',
    releasing: 'Admin approved · Razorpay processing payout',
    released: 'Razorpay transfer processed to linked account',
    refunding: 'Refund processing',
    refunded: 'Refunded',
    disputed: 'Under dispute review',
  })[payment.status] || payment.status
}

function PaymentRow({ payment, role }) {
  const payoutDate = payment.releasedAt || payment.paidAt || payment.createdAt
  return (
    <article className="payment-history-row">
      <div className="payment-history-main">
        <span className="payment-history-icon"><CircleDollarSign size={19} /></span>
        <div><strong>{payment.gig?.title || 'Gig transaction'}</strong><span>{role === 'student' ? 'Client payment and your payout' : 'Project payment'} · {formatDate(payoutDate)}</span></div>
      </div>
      <div className="payment-history-details">
        <span><small>{role === 'student' ? 'Student share' : 'Project total'}</small><strong>{formatRupees(role === 'student' ? payment.studentAmount : payment.totalAmount)}</strong></span>
        {role === 'student' && <span><small>Project total · platform fee</small><strong>{formatRupees(payment.totalAmount)} · {formatRupees(payment.platformFee)}</strong></span>}
        <span className={'payment-history-status status-' + payment.status}><small>Status</small><strong>{statusCopy(payment)}</strong></span>
      </div>
      {payment.razorpayPaymentId && <p className="payment-history-reference">Razorpay payment ID: <code>{payment.razorpayPaymentId}</code></p>}
      {payment.gig?._id && <Link className="payment-history-link" to={'/gigs/' + payment.gig._id}>Open project <ArrowUpRight size={14} /></Link>}
    </article>
  )
}

export default function PaymentHistory({ role = 'student', title = 'Transaction history' }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => apiClient.get('/payments/mine')
      .then(({ data }) => { if (active) { setPayments(Array.isArray(data) ? data : []); setError('') } })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load payment history.')) })
      .finally(() => { if (active) setLoading(false) })
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    const timer = window.setInterval(refreshWhenVisible, 30 * 1000)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [])

  const released = payments.filter((payment) => payment.status === 'released' && payment.mode !== 'test')
    .reduce((total, payment) => total + Number(payment.studentAmount || 0), 0)
  const held = payments.filter((payment) => ['paid', 'escrowed', 'releasing'].includes(payment.status) && payment.mode !== 'test')
    .reduce((total, payment) => total + Number(payment.studentAmount || 0), 0)

  return (
    <section className="payment-history-section" aria-label={title}>
      <div className="payment-history-heading"><div><p className="eyebrow">Payments</p><h2>{title}</h2><p>{role === 'student' ? 'See client payments, held amounts, and payouts for your work.' : 'See payments recorded for your posted projects.'}</p></div><Link to="/payments">Payment activity <ArrowUpRight size={15} /></Link></div>
      {role === 'student' && !loading && !error && <div className="payment-earnings-summary"><article><span>Released to linked accounts</span><strong>{formatRupees(released)}</strong></article><article><span>Awaiting admin payout</span><strong>{formatRupees(held)}</strong></article></div>}
      {loading ? <LoadingState message="Loading transaction history…" /> : error ? <ErrorState message={error} /> : payments.length ? <div className="payment-history-list">{payments.map((payment) => <PaymentRow key={payment._id} payment={payment} role={role} />)}</div> : <EmptyState title="No transactions yet" message="Payments for your projects will be listed here with their current status." />}
      <p className="payment-history-note"><ExternalLink size={13} /> Razorpay transfer processing is asynchronous. The bank settlement schedule determines when funds appear in the student’s bank account.</p>
    </section>
  )
}
