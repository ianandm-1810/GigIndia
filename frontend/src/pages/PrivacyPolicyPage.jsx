import { Link } from 'react-router-dom'
import PageHeading from '../components/common/PageHeading.jsx'

const updatedOn = '2026-10-23'

export default function PrivacyPolicyPage() {
  return (
    <article className="legal-page content-page">
      <PageHeading
        eyebrow="GIG INDIA · Privacy"
        title="Your data, clearly explained."
        description="See what information GIG INDIA handles, why it is used, and how to contact us about a privacy request."
      />

      <div className="legal-meta">
        <span className="legal-status">GIG INDIA</span>
        <time dateTime={updatedOn}>Last updated: 23 October 2026</time>
      </div>

      <aside className="legal-draft-banner" role="note">
        <strong>Privacy questions or requests?</strong>
        <p>
          Contact GIG INDIA through the{' '}
          <Link className="legal-inline-link" to="/support">Help &amp; Support page</Link>.
        </p>
      </aside>

      <nav className="legal-toc" aria-label="Privacy notice sections">
        <a href="#information">Information</a>
        <a href="#uses">How we use it</a>
        <a href="#sharing">Sharing</a>
        <a href="#storage">Browser storage</a>
        <a href="#choices">Your choices</a>
        <a href="#contact">Contact</a>
      </nav>

      <section className="legal-section" id="information">
        <p className="eyebrow">01 · What the app handles</p>
        <h2>Information you provide or create</h2>
        <ul>
          <li><strong>Account and profile:</strong> name, email, password hash, account role, college, optional WhatsApp number, skills, bio, profile photo, and portfolio files or links.</li>
          <li><strong>Marketplace activity:</strong> gig descriptions, budgets, deadlines, attachments, proposals, delivery details, reviews, and project status.</li>
          <li><strong>Chat and shared files:</strong> messages, image/video links, sender and recipient, and timestamps. Gig chat is for its client and assigned student. Student-to-student chat starts only after a request is accepted. Authorized GIG INDIA administrators can review and block student chats for safety or moderation. Chat is not end-to-end encrypted.</li>
          <li><strong>Payment records:</strong> amounts, fee calculations, Razorpay order/payment/transfer/refund identifiers and statuses, and a student’s Razorpay Route linked-account identifier where configured. Razorpay handles checkout and payment details entered there.</li>
          <li><strong>Support requests:</strong> the name, email, role, topic, and message submitted through the support form. The form emails the configured GIG INDIA support inbox and does not save the request in the app database.</li>
        </ul>
        <p>Please do not send passwords, one-time codes, card details, UPI PINs, or other highly sensitive information through chat, email, or WhatsApp.</p>
      </section>

      <section className="legal-section" id="uses">
        <p className="eyebrow">02 · Why it is used</p>
        <h2>To run the marketplace and help keep it safe</h2>
        <p>GIG INDIA uses account and profile information to create and secure accounts; marketplace and proposal details to connect clients with students; messages and files to provide project chat and submissions; and payment records to create orders, verify payment events, track transfers, and support payment questions.</p>
        <p>Contact details may be used for account, password-reset, project, payment, and support emails or WhatsApp notifications. We use support messages to reply to the person who contacted us and to investigate the reported issue.</p>
      </section>

      <section className="legal-section" id="sharing">
        <p className="eyebrow">03 · Who may receive it</p>
        <h2>People involved in the service</h2>
        <p>Information is shared with the people who need it to complete a gig. For example, a client receives proposals for their gig, and the client and assigned student can use that gig’s project chat. A client's profile details may appear alongside their public gig. A student's full profile, social links, and portfolio are shown to that gig's client only after the client accepts the student's proposal. Student search results show username and display name, not email or phone. Public gig details may be visible to marketplace visitors. Authorized GIG INDIA administrators may review relevant chats and records to provide support, handle safety reports or disputes, and maintain the service.</p>
        <p>The app is configured to use MongoDB for marketplace records, Cloudinary for uploaded files, Razorpay for checkout and payment transfers, Twilio for WhatsApp notifications, and Gmail through Nodemailer for email delivery. Those providers process information under their own services and terms. Hosting providers may also process technical request data when the app is deployed.</p>
        <p>When you open a WhatsApp support link, WhatsApp handles that conversation. Automated WhatsApp notifications may be sent through Twilio when the feature and your contact number are configured.</p>
      </section>

      <section className="legal-section" id="storage">
        <p className="eyebrow">04 · Your browser and security</p>
        <h2>Local storage, app files, and access</h2>
        <p>The browser stores your sign-in token and role, plus your theme preference, in local storage. The production app’s service worker can cache static app files for loading; it excludes API requests and requests carrying an authorization header from that cache. Sign out on shared devices and do not share your login details.</p>
        <p>We use access controls and service providers to operate the app, but no online service can promise perfect security. The current project chat is stored by the app and is not end-to-end encrypted.</p>
      </section>

      <section className="legal-section" id="choices">
        <p className="eyebrow">05 · Requests and retention</p>
        <h2>Contact us about your information</h2>
        <p>You can contact us through the <Link className="legal-inline-link" to="/support">GIG INDIA support page</Link> to ask about accessing or correcting information, changing an optional WhatsApp number, withdrawing a notification preference, or deleting information. In the support form, choose “Other” and start your message with “Privacy request.” We may need to verify that the request relates to your account.</p>
        <p>When an administrator removes an account, the account is blocked and its public profile details are anonymized. Related gigs, proposals, chat records, uploaded files, and payment records may remain so the platform can preserve project history, safety records, and payment records. Account removal does not automatically delete files already held by storage providers or records held by payment providers.</p>
        <p>Different records are retained for account access, project history, safety reviews, support, and payment accounting. This page does not provide a fixed deletion schedule; contact support for a request about your information. Do not upload documents or share information that a gig does not need.</p>
      </section>

      <section className="legal-section" id="contact">
        <p className="eyebrow">06 · Contact and review</p>
        <h2>Talk to GIG INDIA</h2>
        <p>For privacy questions, use the <Link className="legal-inline-link" to="/support">GIG INDIA Help &amp; Support page</Link>. GIG INDIA is the platform brand; the operator’s legal name and principal address have not been supplied for this page and must be added to the published privacy contact details.</p>
        <p>This notice describes the app’s data flows. It should be reviewed against applicable Indian requirements, including the <a className="legal-inline-link" href="https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse" target="_blank" rel="noreferrer">Digital Personal Data Protection Act, 2023</a> and the <a className="legal-inline-link" href="https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025" target="_blank" rel="noreferrer">Digital Personal Data Protection Rules, 2025</a>, as applicable.</p>
      </section>
    </article>
  )
}
