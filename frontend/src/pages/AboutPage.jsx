import { ArrowRight, BriefcaseBusiness, Compass, Sparkles } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'

const steps = [
  { icon: Compass, title: 'Explore', text: 'Browse open gigs and read the scope, budget, category, and deadline before deciding if a project fits.' },
  { icon: BriefcaseBusiness, title: 'Propose', text: 'Share a cover letter, proposed amount, and delivery time. The client can review proposals and choose a student.' },
  { icon: Sparkles, title: 'Work and grow', text: 'Use the gig conversation to coordinate and build experience through real client work.' },
]

export default function AboutPage() {
  return (
    <div className="content-page">
      <PageHeading eyebrow="How it works" title="A first step into freelance work." description="GigIndia is designed to make student-sized projects easier to discover, propose on, and complete." />
      <div className="about-flow">{steps.map(({ icon: Icon, title, text }, index) => <section className="about-step surface-card" key={title}><span className="about-step-index">0{index + 1}</span><span className="about-step-icon"><Icon size={22} /></span><div><h2>{title}</h2><p>{text}</p></div>{index < steps.length - 1 && <ArrowRight className="about-step-arrow" size={20} />}</section>)}</div>
      <section className="notice-card"><h2>Where the product is today</h2><p>Gig discovery, accounts, proposals, file uploads, and chat are connected to the current backend. Payment verification is in development; actual student payouts and automatic release are not connected yet.</p></section>
      <Button to="/browse-gigs">Explore open gigs <ArrowRight size={17} /></Button>
    </div>
  )
}
