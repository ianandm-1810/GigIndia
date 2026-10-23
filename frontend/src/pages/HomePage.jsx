import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, Compass, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import Reveal from '../components/common/Reveal.jsx'
import TechPulse from '../components/features/TechPulse.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const steps = [
  { number: '01', icon: Compass, title: 'Find a good fit', text: 'Explore short projects across design, coding, writing, video, and more.', color: 'step-purple' },
  { number: '02', icon: BriefcaseBusiness, title: 'Make your case', text: 'Send a proposal with your approach, price, and delivery timeline.', color: 'step-pink' },
  { number: '03', icon: Check, title: 'Build your proof', text: 'Deliver real work, grow your portfolio, and keep project updates together.', color: 'step-yellow' },
]

export default function HomePage() {
  const { user } = useAuth()
  const nextPath = user?.role === 'client' ? '/client' : user?.role === 'admin' ? '/admin' : '/student'

  return (
    <>
      <section className="hero-section">
        <div className="hero-dot-grid" aria-hidden="true" />
        <span className="hero-shape hero-shape-star" aria-hidden="true">✳</span>
        <span className="hero-shape hero-shape-spark" aria-hidden="true">✦</span>
        <span className="hero-shape hero-shape-orbit" aria-hidden="true" />

        <div className="hero-copy">
          <p className="hero-kicker"><Sparkles size={14} /> MADE FOR INDIA'S NEXT GENERATION OF MAKERS</p>
          <h1 className="hero-title">
            <span>YOUR SKILLS</span>
            <span className="hero-title-purple">DESERVE A</span>
            <span>REAL <b>GIG.</b></span>
          </h1>
          <p className="hero-lede">Find student-friendly projects, work with real clients, and turn what you know into experience you can show.</p>
          <div className="hero-actions">
            <Button to={user ? nextPath : '/register'} size="large">{user ? 'Go to your dashboard' : 'Find your first gig'} <ArrowUpRight size={18} /></Button>
            <Button to="/browse-gigs" variant="secondary" size="large">Explore open gigs <ArrowRight size={17} /></Button>
          </div>
          <div className="hero-proof">
            <span className="proof-icon"><ShieldCheck size={17} /></span>
            <span>Clear project details <i /> Student-sized opportunities <i /> Progress you can show</span>
          </div>
        </div>

        <div className="hero-float hero-float-left" aria-hidden="true">
          <span className="hero-float-icon float-icon-yellow"><WalletCards size={18} /></span>
          <span><small>YOUR WORK, YOUR PROOF</small><strong>Build as you go</strong></span>
          <span className="float-spark">✦</span>
        </div>
        <div className="hero-float hero-float-right" aria-hidden="true">
          <span className="hero-float-icon float-icon-pink"><BriefcaseBusiness size={18} /></span>
          <span><small>STUDENT MARKETPLACE</small><strong>Find work that fits</strong></span>
          <span className="float-arrow"><ArrowUpRight size={17} /></span>
        </div>
        <div className="hero-scroll"><span /> SCROLL TO EXPLORE <span /></div>
      </section>

      <TechPulse />

      <section className="intro-section section-wrap">
        <Reveal className="intro-copy">
          <p className="eyebrow">Not just another job board</p>
          <h2>Small projects.<br /><span>Real momentum.</span></h2>
        </Reveal>
        <Reveal className="intro-aside">
          <p>GIG INDIA helps college students take the first step into freelance work. Find a project, tell a client how you can help, and build a portfolio with work you actually did.</p>
          <Link className="arrow-link" to="/about">See how it works <ArrowUpRight size={17} /></Link>
        </Reveal>
      </section>

      <section className="steps-section section-wrap">
        <Reveal className="section-heading-row">
          <div><p className="eyebrow">A simple way to begin</p><h2>Make your skills<br />work in the real world.</h2></div>
          <p className="section-side-copy">No years of experience required to take the first step. Start with what you know and grow from there.</p>
        </Reveal>
        <div className="steps-grid">
          {steps.map(({ number, icon: Icon, title, text, color }) => (
            <Reveal key={number}>
              <Card className={`step-card ${color}`}>
                <div className="step-top"><span className="step-number">{number}</span><span className="step-icon"><Icon size={20} /></span></div>
                <h3>{title}</h3><p>{text}</p>
                <span className="step-bottom-line" />
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="feature-band">
        <div className="feature-band-inner section-wrap">
          <Reveal className="feature-copy"><p className="eyebrow eyebrow-light">Made for the in-between</p><h2>Build experience<br />while you're still <span>becoming.</span></h2><p>College is a great time to experiment. GIG INDIA gives your curiosity a place to turn into practical experience—on a schedule that can fit around classes.</p><Button to={user ? '/browse-gigs' : '/register'} variant="light" size="large">{user ? 'Browse gigs' : 'Find your first project'} <ArrowUpRight size={17} /></Button></Reveal>
          <Reveal className="feature-visual"><div className="feature-orbit" /><div className="feature-card"><div className="feature-card-head"><span className="feature-dot" /><span>THE GIG FLOW</span><span className="feature-menu">•••</span></div><div className="flow-item"><span className="flow-index">01</span><span className="flow-icon violet"><Compass size={17} /></span><div><strong>Explore</strong><small>Find a project that fits</small></div><Check size={16} className="flow-check" /></div><div className="flow-connector" /><div className="flow-item"><span className="flow-index">02</span><span className="flow-icon aqua"><BriefcaseBusiness size={17} /></span><div><strong>Propose</strong><small>Share your plan</small></div><span className="flow-current">NEXT</span></div><div className="flow-connector" /><div className="flow-item flow-muted"><span className="flow-index">03</span><span className="flow-icon mint"><Sparkles size={17} /></span><div><strong>Deliver</strong><small>Build your experience</small></div></div><div className="feature-card-footer"><span>One clear next step.</span><ArrowRight size={15} /></div></div></Reveal>
        </div>
      </section>

      <section className="closing-cta section-wrap"><Reveal><div className="closing-cta-inner"><div><p className="eyebrow">Your next step is yours</p><h2>Curious where your skills<br />could take you?</h2></div><Button to={user ? '/browse-gigs' : '/register'} size="large">{user ? 'Explore gigs' : 'Join GIG INDIA'} <ArrowUpRight size={18} /></Button></div></Reveal></section>
    </>
  )
}
