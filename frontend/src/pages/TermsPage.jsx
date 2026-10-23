import PageHeading from '../components/common/PageHeading.jsx'

export default function TermsPage() {
  return (
    <article className="legal-page">
      <PageHeading eyebrow="Terms" title="Clear expectations make better work." description="This page is a development notice, not a final agreement for real clients or students." />
      <section><h2>Use of the current build</h2><p>GIGI India is being developed to help students and clients discover and manage small freelance projects. The current build is for development and testing. Do not rely on it to hold, safeguard, or automatically release real funds.</p></section>
      <section><h2>Payments and project work</h2><p>Razorpay order creation and payment verification are present in the backend, but actual student payouts, dispute decisions, refunds, and automatic release are not implemented. Payment status shown in the app is not proof of a completed payout.</p></section>
      <section><h2>Before public launch</h2><p>Final terms need the platform operator’s identity, dispute and refund rules, fees, cancellation conditions, acceptable-use rules, and support contact. Have the completed terms reviewed before opening the service to real users.</p></section>
    </article>
  )
}
