import { ArrowUpRight, CircleDollarSign, ShieldAlert } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'

export default function PaymentsPage() {
  return (
    <div className="content-page narrow-content">
      <PageHeading eyebrow="Payments" title="Payment activity follows a gig." description="Checkout starts from an assigned gig, where its client can create a Razorpay order." />
      <section className="payment-status-panel"><span className="payment-status-icon"><CircleDollarSign size={24} /></span><div><h2>Payment tracking is in development</h2><p>The current backend does not expose a payment-history endpoint. Open an assigned gig to start checkout or see its recorded status.</p><Button to="/browse-gigs" variant="secondary">Browse gigs <ArrowUpRight size={16} /></Button></div></section>
      <div className="notice-card"><h2><ShieldAlert size={18} /> Important payment limitation</h2><p>The current payment endpoints verify Razorpay checkout and update database status. They do not transfer funds to a student, provide a regulated escrow, or automatically release payment after five days. Do not use this development build to process real project funds.</p></div>
    </div>
  )
}
