import { ArrowRight, BriefcaseBusiness, Compass, Sparkles } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'

const steps = [
  { icon: Compass, title: 'Explore', text: 'Browse open gigs and read the scope, budget, category, and deadline before deciding if a project fits.' },
  { icon: BriefcaseBusiness, title: 'Propose', text: 'Share a cover letter, proposed amount, and delivery time. The client can review proposals and choose a student.' },
  { icon: Sparkles, title: 'Deliver and get paid', text: 'Submit your work through the project page. The client pays and reviews the delivery, then closes the project. A GIG INDIA admin approves the 90% student payout.' },
]

export default function AboutPage() {
  return (
    <div className="content-page">
      <PageHeading eyebrow="How it works" title="A first step into freelance work." description="GIG INDIA is designed to make student-sized projects easier to discover, propose on, and complete." />
      <div className="about-flow">{steps.map(({ icon: Icon, title, text }, index) => <section className="about-step surface-card" key={title}><span className="about-step-index">0{index + 1}</span><span className="about-step-icon"><Icon size={22} /></span><div><h2>{title}</h2><p>{text}</p></div>{index < steps.length - 1 && <ArrowRight className="about-step-arrow" size={20} />}</section>)}</div>
      <section className="notice-card"><h2>Payment and project closeout</h2><p>The client pays after the student submits work. Razorpay records the payment to GIG INDIA, then the client reviews the delivery and closes the project. A GIG INDIA admin reviews and approves the 90% student payout; GIG INDIA retains a 10% platform fee. Razorpay processes the transfer asynchronously, and both dashboards keep the project and transaction history.</p></section>
      <Button to="/browse-gigs">Explore open gigs <ArrowRight size={17} /></Button>
    </div>
  )
}
