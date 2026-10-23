import { BriefcaseBusiness, Home, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import Button from '../common/Button.jsx'
import InstallPrompt from '../common/InstallPrompt.jsx'
import NetworkStatus from '../common/NetworkStatus.jsx'
import ThemeToggle from '../common/ThemeToggle.jsx'

const currentYear = new Date().getFullYear()

function getDashboardPath(role) {
  if (role === 'client') return '/client'
  if (role === 'admin') return '/admin'
  return '/student'
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    setMenuOpen(false)
    showToast('You are signed out.')
    navigate('/')
  }

  const dashboardPath = user ? getDashboardPath(user.role) : '/login'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <NetworkStatus />
      <div className="announcement-strip">
        <p className="sr-only">Student-sized freelance projects. Real client experience. Your next step starts here.</p>
        <div className="announcement-track" aria-hidden="true">
          <span>STUDENT-SIZED GIGS <b>✦</b> REAL CLIENT EXPERIENCE <b>✦</b> BUILD YOUR PORTFOLIO <b>✦</b> YOUR NEXT STEP STARTS HERE <b>✦</b></span>
          <span>STUDENT-SIZED GIGS <b>✦</b> REAL CLIENT EXPERIENCE <b>✦</b> BUILD YOUR PORTFOLIO <b>✦</b> YOUR NEXT STEP STARTS HERE <b>✦</b></span>
        </div>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand-lockup" to="/" aria-label="GIGI India home">
            <span className="brand-mark" aria-hidden="true">G</span>
            <span className="brand-word"><strong className="brand-name">GIGI</strong><span>India</span></span>
          </Link>
          <button className="icon-button mobile-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <nav id="primary-navigation" className={'desktop-nav' + (menuOpen ? ' nav-open' : '')} aria-label="Main navigation">
            <NavLink to="/browse-gigs" onClick={() => setMenuOpen(false)}>Explore gigs</NavLink>
            {user && <NavLink to={dashboardPath} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>}
            {user && <NavLink to="/payments" onClick={() => setMenuOpen(false)}>Payments</NavLink>}
            {user?.role === 'client' && <NavLink to="/post-gig" onClick={() => setMenuOpen(false)}>Post a gig</NavLink>}
            <NavLink to="/about" onClick={() => setMenuOpen(false)}>How it works</NavLink>
            <NavLink to="/support" onClick={() => setMenuOpen(false)}>Help &amp; Support</NavLink>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {user ? (
              <>
                <Link className="profile-chip" to="/profile"><span className="avatar avatar-small">{user.name?.slice(0, 1) || 'G'}</span><span className="profile-chip-name">{user.name?.split(' ')[0] || 'Account'}</span></Link>
                <button className="icon-button logout-button" type="button" onClick={handleLogout} aria-label="Log out" title="Log out"><LogOut size={17} /></button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="small" to="/login">Log in</Button>
                <Button variant="primary" size="small" to="/register">Join GIGI India <span aria-hidden="true">↗</span></Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="site-main" id="main-content">
        <div className="route-view"><Outlet /></div>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <Link className="brand-lockup footer-brand" to="/" aria-label="GIGI India home"><span className="brand-mark" aria-hidden="true">G</span><span className="brand-word"><strong className="brand-name">GIGI</strong><span>India</span></span></Link>
          <p>Small projects. Real momentum.</p>
          <div className="footer-links"><Link to="/support">Help &amp; Support</Link><Link to="/privacy-policy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/about">How it works</Link></div>
          <small>© {currentYear} GIGI India</small>
        </div>
      </footer>
      <nav className="mobile-tabbar" aria-label="Mobile navigation">
        <NavLink to="/" end aria-label="Home"><Home size={19} /><span>Home</span></NavLink>
        <NavLink to="/browse-gigs" aria-label="Explore gigs"><BriefcaseBusiness size={19} /><span>Explore</span></NavLink>
        {user ? <NavLink to={dashboardPath} aria-label="Dashboard"><span className="tab-avatar">{user.name?.slice(0, 1) || 'G'}</span><span>Home</span></NavLink> : <NavLink to="/login" aria-label="Log in"><UserRound size={19} /><span>Log in</span></NavLink>}
        {user ? <NavLink to="/profile" aria-label="Profile"><UserRound size={19} /><span>Profile</span></NavLink> : <NavLink to="/register" aria-label="Sign up"><span className="tab-plus">+</span><span>Join</span></NavLink>}
      </nav>
      <InstallPrompt />
    </div>
  )
}
