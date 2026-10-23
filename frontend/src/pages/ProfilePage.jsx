import { useRef, useState } from 'react'
import { BriefcaseBusiness, Camera, ExternalLink, FileText, ShieldAlert, Trash2, Upload, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

const portfolioTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const photoInput = useRef(null)
  const portfolioInput = useRef(null)
  const [busy, setBusy] = useState('')
  const [accountPassword, setAccountPassword] = useState('')

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
      <PageHeading eyebrow="Your account" title="Your profile, in one place." description="Manage your profile photo and portfolio files. Profile text editing is not available in the current backend yet." />
      <div className="profile-layout">
        <Card className="profile-card">
          <div className="profile-identity">
            <div className="profile-avatar-wrap">{user?.profilePhoto ? <img className="profile-avatar-image" src={user.profilePhoto} alt={user.name + ' profile'} /> : <span className="profile-avatar-fallback" aria-hidden="true">{initials}</span>}<button type="button" className="avatar-edit-button" aria-label="Choose profile photo" onClick={() => photoInput.current?.click()} disabled={busy === 'photo'}><Camera size={16} /></button></div>
            <div><h2>{user?.name}</h2><p>{user?.email}</p><span className="profile-role-badge">{user?.role === 'client' ? 'Client' : user?.role === 'admin' ? 'Admin' : 'Student'}</span></div>
          </div>
          <input ref={photoInput} className="sr-only" type="file" accept="image/jpeg,image/png" onChange={uploadPhoto} />
          <div className="profile-facts"><div><span>College / organization</span><strong>{user?.college || 'Not added'}</strong></div><div><span>Member since</span><strong>{user?.createdAt ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt)) : '—'}</strong></div><div><span>Account email</span><strong>{user?.email}</strong></div></div>
          <div className="profile-skills"><h3><UserRound size={17} /> About your account</h3><p>{user?.bio || 'A profile bio and editable skills will be available when profile update endpoints are added.'}</p>{Array.isArray(user?.skills) && user.skills.length > 0 && <div className="skill-list">{user.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>}</div>
          <p className="subtle-note"><ShieldAlert size={16} /> Your profile details are loaded from GIG INDIA. This screen does not pretend to save fields the backend cannot update.</p>
        </Card>

        <Card className="portfolio-card">
          <div className="portfolio-heading"><div><p className="eyebrow">Show what you can do</p><h2>Your portfolio</h2><p>Add a few examples that represent your own work.</p></div><Button type="button" variant="secondary" onClick={() => portfolioInput.current?.click()} loading={busy === 'portfolio'}><Upload size={16} /> Add file</Button></div>
          <input ref={portfolioInput} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" onChange={uploadPortfolio} />
          {user?.portfolio?.length ? <ul className="portfolio-list">{user.portfolio.map((fileUrl) => <li key={fileUrl}><span className="portfolio-file-icon"><FileText size={18} /></span><a href={fileUrl} target="_blank" rel="noreferrer">Portfolio file <ExternalLink size={14} /></a><button type="button" className="icon-button danger-icon" onClick={() => removePortfolioFile(fileUrl)} disabled={busy === 'delete-portfolio'} aria-label="Remove portfolio file"><Trash2 size={16} /></button></li>)}</ul> : <div className="portfolio-empty"><span><BriefcaseBusiness size={21} /></span><h3>No portfolio files yet</h3><p>Upload a PDF or image. JPG and PNG files are also supported.</p><Button type="button" variant="ghost" onClick={() => portfolioInput.current?.click()}><Upload size={16} /> Choose a file</Button></div>}
          <p className="form-note">Files are uploaded to Cloudinary and linked to this account. Only share work you have permission to publish.</p>
        </Card>

        <Card className="danger-zone">
          <div><p className="eyebrow">Account controls</p><h2>Delete account</h2><p>This permanently deletes your account record. Review any active gigs or payment questions before proceeding.</p></div>
          <form className="delete-account-form" onSubmit={deleteAccount}><label htmlFor="delete-password">Confirm with your password</label><input id="delete-password" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} required /><Button type="submit" variant="danger" loading={busy === 'delete-account'}><Trash2 size={16} /> Delete my account</Button></form>
        </Card>
      </div>
    </div>
  )
}
