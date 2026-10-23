import { Link } from 'react-router-dom'
import PageHeading from '../components/common/PageHeading.jsx'

const updatedOn = '2026-10-23'

export default function TermsPage() {
  return (
    <article className="legal-page content-page">
      <PageHeading
        eyebrow="GIG INDIA · Terms"
        title="Fair work starts with clear terms."
        description="These terms describe the GIG INDIA marketplace, project workflow, and payment status shown in the service."
      />

      <div className="legal-meta">
        <span className="legal-status">GIG INDIA</span>
        <time dateTime={updatedOn}>Last updated: 23 October 2026</time>
      </div>

      <aside className="legal-draft-banner" role="note">
        <strong>Need help with an account, project, or payment?</strong>
        <p>
          Contact GIG INDIA through{' '}
          <Link className="legal-inline-link" to="/support">Help &amp; Support</Link>.
        </p>
      </aside>

      <nav className="legal-toc" aria-label="Terms sections">
        <a href="#marketplace">Marketplace</a>
        <a href="#accounts">Accounts</a>
        <a href="#work">Gigs and work</a>
        <a href="#payments">Payments</a>
        <a href="#disputes">Disputes</a>
        <a href="#contact">Contact</a>
      </nav>

      <section className="legal-section" id="marketplace">
        <p className="eyebrow">01 · The service</p>
        <h2>A marketplace for student-sized projects</h2>
        <p>GIG INDIA provides a marketplace where clients can post projects and students can submit proposals, complete work, and build experience. The service connects the project workflow, chat, delivery submission, payment status, and project history.</p>
      </section>

      <section className="legal-section" id="accounts">
        <p className="eyebrow">02 · Your account</p>
        <h2>Keep your details accurate and secure</h2>
        <p>Choose the account role that describes how you use the marketplace: student or client. Provide accurate information, keep your password private, and tell GIG INDIA if you believe someone has accessed your account. Do not impersonate another person, share an account, or use the service to mislead other members.</p>
        <p>Admin accounts are created and managed by GIG INDIA; the public registration form is for student and client accounts.</p>
      </section>

      <section className="legal-section" id="work">
        <p className="eyebrow">03 · Gigs and project work</p>
        <h2>Agree on the work before it starts</h2>
        <p>Clients are responsible for describing the scope, budget, deadline, and requirements clearly and for having the rights to any materials they provide. Students should apply only to work they can reasonably complete, explain their proposed price and timeline, and communicate about delays or changes.</p>
        <p>When a client accepts a proposal, the app assigns the student to that gig and provides a project chat for the two participants. Keep project instructions, changes, submissions, and approvals in that chat where practical. Do not upload unlawful, fraudulent, harmful, or infringing material, or ask another member to do so.</p>
        <p>Before work starts, agree on who may use the final deliverables and any third-party material. GIG INDIA does not transfer intellectual-property rights between the client and student; they should record their agreement in the project chat.</p>
        <p>Project chat is visible to the client and assigned student through the app; it is stored by the service and is not end-to-end encrypted. Authorized GIG INDIA administrators may review retained chats for support, safety reports, payment disputes, or service operations.</p>
        <p>Students may search other student accounts by username and send a chat request. A private student chat is available only after the other student accepts. Do not share phone numbers, email addresses, abusive language, or inappropriate content in chat. GIG INDIA administrators can inspect and block student chats to address safety or moderation concerns.</p>
      </section>

      <section className="legal-section" id="payments">
        <p className="eyebrow">04 · Payment status and fees</p>
        <h2>Understand each payment status</h2>
        <p>The client pays after the student submits the agreed work. The app calculates a 10% GIG INDIA platform fee and a 90% student share from the agreed project amount. For live payments, Razorpay processes checkout; student payouts require Razorpay Route and an active linked account for that student.</p>
        <p>A captured payment is not the same as a payout. The payment is collected by GIG INDIA first. The client reviews the submission and closes the project, after which a GIG INDIA admin can approve the student’s 90% transfer. The app does not automatically release a payout. In test mode, transaction and payout states are simulated and no real money moves.</p>
        <p>After approval, Razorpay processes the transfer asynchronously. “Payout processed” means Razorpay confirmed the transfer to the student’s linked account; bank settlement timing may affect when funds appear in the student’s bank account. The app does not collect a student’s bank password, card PIN, or UPI PIN. Never send those secrets to GIG INDIA or another member.</p>
      </section>

      <section className="legal-section" id="disputes">
        <p className="eyebrow">05 · Problems, refunds, and cancellations</p>
        <h2>Ask for help when a project gets stuck</h2>
        <p>The app contains a dispute flow for eligible submitted work. A dispute pauses payout while an administrator reviews it; the backend has actions to approve a student transfer or request a Razorpay refund. Actual results depend on the payment provider and account setup.</p>
        <p>Share relevant project and payment information through the support flow. A refund or payout action is subject to payment-provider processing and the result shown in the transaction history.</p>
        <p>For help, contact GIG INDIA through the <Link className="legal-inline-link" to="/support">Help &amp; Support page</Link>. Do not send passwords, one-time codes, card details, or UPI PINs in a support request.</p>
      </section>

      <section className="legal-section" id="contact">
        <p className="eyebrow">06 · Contact and updates</p>
        <h2>Contact GIG INDIA</h2>
        <p>For account, project, safety, or payment support, use the <Link className="legal-inline-link" to="/support">GIG INDIA support page</Link>. Keep your login credentials, one-time passwords, card details, and UPI PIN private.</p>
        <p>GIG INDIA is the platform brand. The operator’s legal name and principal address have not been supplied for this page; they should be published along with the required customer-care and grievance contact details before public marketplace operations.</p>
        <p>These terms were last updated on 23 October 2026. Any material service or payment-flow changes will be reflected here. Where applicable, the service is also subject to the <a className="legal-inline-link" href="https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules.pdf" target="_blank" rel="noreferrer">Consumer Protection (E-Commerce) Rules, 2020</a>.</p>
      </section>
    </article>
  )
}
