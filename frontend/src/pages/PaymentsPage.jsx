import PaymentHistory from '../components/features/PaymentHistory.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function PaymentsPage() {
  const { user } = useAuth()
  return (
    <div className="content-page narrow-content">
      <PageHeading eyebrow="Payments" title="Payment activity follows a gig." description="Track client payments, held transfers, payouts, and refunds linked to your projects." />
      {['student', 'client'].includes(user?.role)
        ? <PaymentHistory role={user.role} title="Your payment activity" />
        : <section className="notice-card"><h2>Payment activity</h2><p>Open the admin dashboard to review platform-wide payment records and actions.</p></section>}
    </div>
  )
}
