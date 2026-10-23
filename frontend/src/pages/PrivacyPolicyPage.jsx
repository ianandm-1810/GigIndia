import PageHeading from '../components/common/PageHeading.jsx'

export default function PrivacyPolicyPage() {
  return (
    <article className="legal-page">
      <PageHeading eyebrow="Privacy" title="Your information, treated with care." description="This is a product privacy summary for the current development version, not a substitute for a reviewed legal privacy notice." />
      <section><h2>Information the current app uses</h2><p>Account details include name, email, password hash, role, college, and optional WhatsApp number. GIGI India also stores gig and proposal details, profile and portfolio file URLs, chat messages, and payment status records needed by the current features. If you contact support, your name, email address, account type, topic, and message are emailed to the configured support inbox and are not written to the app database.</p></section>
      <section><h2>Service providers</h2><p>The backend is configured to use MongoDB for records, Cloudinary for uploaded files, Razorpay for checkout, Twilio for WhatsApp notifications, and email delivery for account and support messages. WhatsApp support conversations are handled through the public support number configured by the platform. Do not send passwords, one-time codes, bank details, or sensitive personal documents through support channels.</p></section>
      <section><h2>Before public launch</h2><p>The final policy needs to state the operating entity and contact details, retention periods, user rights and deletion process, provider terms, and applicable legal requirements. This draft must be reviewed and completed before collecting real users’ data.</p></section>
    </article>
  )
}
