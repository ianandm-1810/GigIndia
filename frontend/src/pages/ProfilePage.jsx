import { useEffect, useRef, useState } from 'react'
import { BriefcaseBusiness, Camera, ExternalLink, FileText, ShieldAlert, Trash2, Upload, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'
import PaymentHistory from '../components/features/PaymentHistory.jsx'

const portfolioTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
const socialFields = [
  ['github', 'GitHub profile URL'],
  ['linkedin', 'LinkedIn profile URL'],
  ['instagram', 'Instagram profile URL'],
  ['discord', 'Discord profile or invite URL'],
]

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const photoInput = useRef(null)
  const portfolioInput = useRef(null)
  const [busy, setBusy] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [profileForm, setProfileForm] = useState({ username: '', bio: '', companyName: '', portfolioLink: '', skills: '', socialLinks: { github: '', linkedin: '', instagram: '', discord: '' } })
  const [usernameAvailability, setUsernameAvailability] = useState('available')

  useEffect(() => {
    setProfileForm({
      username: user?.username || '',
      bio: user?.bio || '',
      companyName: user?.companyName || '',
      portfolioLink: user?.portfolioLink || '',
      skills: Array.isArray(user?.skills) ? user.skills.join(', ') : '',
      socialLinks: {
        github: user?.socialLinks?.github || '',
        linkedin: user?.socialLinks?.linkedin || '',
        instagram: user?.socialLinks?.instagram || '',
        discord: user?.socialLinks?.discord || '',
      },
    })
  }, [user])

  useEffect(() => {
    if (user?.role !== 'student') {
      setUsernameAvailability('available')
      return undefined
    }
    const candidate = profileForm.username.trim().replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/.test(candidate)) {
      setUsernameAvailability('invalid')
      return undefined
    }
    if (candidate === user?.username) {
      setUsernameAvailability('available')
      return undefined
    }

    let active = true
    setUsernameAvailability('checking')
    const timer = window.setTimeout(() => {
      apiClient.get('/auth/username-availability', { params: { username: candidate } })
        .then(({ data }) => { if (active) setUsernameAvailability(data.available ? 'available' : 'taken') })
        .catch(() => { if (active) setUsernameAvailability('unknown') })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [profileForm.username, user?.username, user?.role])

  async function saveProfile(event) {
    event.preventDefault()
    if (user?.role === 'student' && (usernameAvailability === 'taken' || usernameAvailability === 'invalid')) {
      showToast('Choose a valid, available username before saving.', 'error')
      return
    }
    setBusy('profile')
    try {
      const payload = { bio: profileForm.bio, socialLinks: profileForm.socialLinks }
      if (user?.role === 'student') Object.assign(payload, {
        username: profileForm.username,
        portfolioLink: profileForm.portfolioLink,
        skills: profileForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      })
      if (user?.role === 'client') payload.companyName = profileForm.companyName
      await apiClient.put('/auth/profile', payload)
      await refreshUser()
      showToast('Your profile was saved.')
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save your profile.'), 'error')
    } finally {
      setBusy('')
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Choose a JPG or PNG image for your profile photo.', 'error')
      return
    }
    const formData = new FormData()
    formData.append('photo', file)
    setBusy('photo')
    try {
      await apiClient.post('/upload/profile-photo', formData)
      await refreshUser()
      showToast('Profile photo updated.')
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not upload the profile photo.'), 'error')
    } finally {
      setBusy('')
    }
  }

  async function uploadPortfolio(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!portfolioTypes.includes(file.type)) {
      showToast('Choose a PDF, JPG, or PNG file.', 'error')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    setBusy('portfolio')
    try {
      await apiClient.post('/upload/portfolio', formData)
      await refreshUser()
      showToast('Portfolio file added.')
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not upload this portfolio file.'), 'error')
    } finally {
      setBusy('')
    }
  }

  async function removePortfolioFile(fileUrl) {
    if (!window.confirm('Remove this file from your portfolio?')) return
    setBusy('delete-portfolio')
    try {
      await apiClient.delete('/upload/portfolio', { data: { fileUrl } })
      await refreshUser()
      showToast('Portfolio file removed.')
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not remove the portfolio file.'), 'error')
    } finally {
      setBusy('')
    }
  }

  async function deleteAccount(event) {
    event.preventDefault()
    if (!window.confirm('Delete your GIG INDIA account? This action cannot be undone.')) return
    setBusy('delete-account')
    try {
      await apiClient.delete('/auth/delete-account', { data: { password: accountPassword } })
      logout()
      showToast('Your account has been deleted.')
      navigate('/', { replace: true })
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not delete your account.'), 'error')
    } finally {
      setBusy('')
    }
  }

  const initials = user?.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'GI'

  return (
    <div className="content-page profile-page">
      <PageHeading eyebrow="Your account" title="Your profile, in one place." description={user?.role === 'student' ? 'Keep your profile current so clients can learn about you after you apply and they select you.' : user?.role === 'client' ? 'Tell students about your company or yourself and add social links.' : 'Add an About section and social links for your admin account.'} />
      <div className="profile-layout">
        <Card className="profile-card">
          <div className="profile-identity">
            <div className="profile-avatar-wrap">{user?.profilePhoto ? <img className="profile-avatar-image" src={user.profilePhoto} alt={user.name + ' profile'} /> : <span className="profile-avatar-fallback" aria-hidden="true">{initials}</span>}<button type="button" className="avatar-edit-button" aria-label="Choose profile photo" onClick={() => photoInput.current?.click()} disabled={busy === 'photo'}><Camera size={16} /></button></div>
            <div><h2>{user?.name}</h2><p>{user?.email}</p>{user?.username && <p className="profile-username">@{user.username}</p>}<span className="profile-role-badge">{user?.role === 'client' ? 'Client' : user?.role === 'admin' ? 'Admin' : 'Student'}</span></div>
          </div>
          <input ref={photoInput} className="sr-only" type="file" accept="image/jpeg,image/png" onChange={uploadPhoto} />
          <div className="profile-facts"><div><span>{user?.role === 'client' ? 'Company / organization' : 'College / organization'}</span><strong>{user?.companyName || user?.college || 'Not added'}</strong></div><div><span>Member since</span><strong>{user?.createdAt ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt)) : '—'}</strong></div><div><span>Account email</span><strong>{user?.email}</strong></div></div>
          {user?.role === 'student' ? <form className="profile-edit-form" onSubmit={saveProfile}>
            <div className="profile-edit-heading"><h3><UserRound size={17} /> Student profile</h3><p>Clients can see these details only after you apply to one of their gigs.</p></div>
            <label className="profile-input-field"><span>Custom username</span><div className="username-input-wrap"><span>@</span><input value={profileForm.username} onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} minLength="3" maxLength="24" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,22}[A-Za-z0-9]" autoComplete="username" required /></div><small className={'username-availability username-' + usernameAvailability}>{usernameAvailability === 'available' ? 'Available' : usernameAvailability === 'taken' ? 'Already taken' : usernameAvailability === 'checking' ? 'Checking availability…' : usernameAvailability === 'invalid' ? 'Use 3–24 letters, numbers, _ or -; begin and end with a letter or number.' : 'Availability could not be checked; the server will check when saving.'}</small></label>
            <label className="profile-input-field"><span>About you</span><textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} rows="4" maxLength="500" placeholder="Introduce yourself, what you enjoy working on, and what you can help clients with." /><small>{profileForm.bio.length}/500 characters</small></label>
            <label className="profile-input-field"><span>Skills (comma separated)</span><input value={profileForm.skills} onChange={(event) => setProfileForm((current) => ({ ...current, skills: event.target.value }))} placeholder="React, graphic design, writing" /></label>
            <div className="profile-social-fields">{socialFields.map(([key, label]) => <label className="profile-input-field" key={key}><span>{label}</span><input type="text" value={profileForm.socialLinks[key]} onChange={(event) => setProfileForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, [key]: event.target.value } }))} placeholder="https://…" /></label>)}</div>
            <label className="profile-input-field"><span>Portfolio website link</span><input type="text" value={profileForm.portfolioLink} onChange={(event) => setProfileForm((current) => ({ ...current, portfolioLink: event.target.value }))} placeholder="https://your-portfolio.example" /></label>
            <Button type="submit" loading={busy === 'profile'} disabled={usernameAvailability === 'checking' || usernameAvailability === 'taken' || usernameAvailability === 'invalid'}>Save profile</Button>
            <p className="subtle-note profile-privacy-note"><ShieldAlert size={16} /> Your uploaded portfolio files remain below. Social links, About, and portfolio links are shown to a client only when you have applied to that client’s gig.</p>
          </form> : <form className="profile-edit-form" onSubmit={saveProfile}>
            <div className="profile-edit-heading"><h3><UserRound size={17} /> {user?.role === 'client' ? 'Client profile' : 'Admin profile'}</h3><p>{user?.role === 'client' ? 'Share a short introduction to your business or yourself.' : 'Keep a short About section and social links on your admin profile.'}</p></div>
            {user?.role === 'client' && <label className="profile-input-field"><span>Company / organization name (optional)</span><input value={profileForm.companyName} onChange={(event) => setProfileForm((current) => ({ ...current, companyName: event.target.value }))} maxLength="160" placeholder="Company, club, or your name" /></label>}
            <label className="profile-input-field"><span>About {user?.role === 'client' ? 'your company or yourself' : 'you'}</span><textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} rows="4" maxLength="500" placeholder="A short introduction." /><small>{profileForm.bio.length}/500 characters</small></label>
            <div className="profile-social-fields">{socialFields.map(([key, label]) => <label className="profile-input-field" key={key}><span>{label}</span><input type="text" value={profileForm.socialLinks[key]} onChange={(event) => setProfileForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, [key]: event.target.value } }))} placeholder="https://…" /></label>)}</div>
            <Button type="submit" loading={busy === 'profile'}>Save profile</Button>
          </form>}
        </Card>

        {user?.role === 'student' && <Card className="portfolio-card">
          <div className="portfolio-heading"><div><p className="eyebrow">Show what you can do</p><h2>Your portfolio</h2><p>Add a few examples that represent your own work.</p></div><Button type="button" variant="secondary" onClick={() => portfolioInput.current?.click()} loading={busy === 'portfolio'}><Upload size={16} /> Add file</Button></div>
          <input ref={portfolioInput} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" onChange={uploadPortfolio} />
          {user?.portfolio?.length ? <ul className="portfolio-list">{user.portfolio.map((fileUrl) => <li key={fileUrl}><span className="portfolio-file-icon"><FileText size={18} /></span><a href={fileUrl} target="_blank" rel="noreferrer">Portfolio file <ExternalLink size={14} /></a><button type="button" className="icon-button danger-icon" onClick={() => removePortfolioFile(fileUrl)} disabled={busy === 'delete-portfolio'} aria-label="Remove portfolio file"><Trash2 size={16} /></button></li>)}</ul> : <div className="portfolio-empty"><span><BriefcaseBusiness size={21} /></span><h3>No portfolio files yet</h3><p>Upload a PDF or image. JPG and PNG files are also supported.</p><Button type="button" variant="ghost" onClick={() => portfolioInput.current?.click()}><Upload size={16} /> Choose a file</Button></div>}
          <p className="form-note">Files are uploaded to Cloudinary and linked to this account. Only share work you have permission to publish.</p>
        </Card>}

        <Card className="danger-zone">
          <div><p className="eyebrow">Account controls</p><h2>Delete account</h2><p>This permanently deletes your account record. Review any active gigs or payment questions before proceeding.</p></div>
          <form className="delete-account-form" onSubmit={deleteAccount}><label htmlFor="delete-password">Confirm with your password</label><input id="delete-password" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} required /><Button type="submit" variant="danger" loading={busy === 'delete-account'}><Trash2 size={16} /> Delete my account</Button></form>
        </Card>
      </div>
      {user?.role === 'student' && <PaymentHistory role="student" title="Your project earnings and transactions" />}
    </div>
  )
}
