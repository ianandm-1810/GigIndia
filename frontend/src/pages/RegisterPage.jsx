import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthPanel from '../components/common/AuthPanel.jsx'
import Button from '../components/common/Button.jsx'
import Field from '../components/common/Field.jsx'
import PasswordField from '../components/common/PasswordField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getErrorMessage } from '../utils/errors.js'

const initialForm = { name: '', email: '', password: '', role: 'student', college: '', whatsappNumber: '' }

export default function RegisterPage() {
  const { register } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await register(form)
      showToast('Your GIG INDIA account is ready.')
      navigate(user.role === 'client' ? '/client' : '/student', { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not create your account. Please try again.'))
    } finally { setLoading(false) }
  }

  return (
    <AuthPanel eyebrow="Start small, go far" title="Make room for what you can do." description="Create a profile, find projects that fit around college, and build experience one gig at a time." footer={<>Already joined? <Link to="/login">Log in</Link></>}>
      <div className="auth-form-heading"><p className="eyebrow">Create your account</p><h2>Join GIG INDIA</h2><p>Choose how you want to use the marketplace.</p></div>
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="role-picker" role="radiogroup" aria-label="Account type">
          <button className={'role-option' + (form.role === 'student' ? ' selected' : '')} type="button" role="radio" aria-checked={form.role === 'student'} onClick={() => setForm((current) => ({ ...current, role: 'student' }))}><span className="role-option-icon">01</span><span><strong>I'm a student</strong><small>Find gigs and build experience</small></span></button>
          <button className={'role-option' + (form.role === 'client' ? ' selected' : '')} type="button" role="radio" aria-checked={form.role === 'client'} onClick={() => setForm((current) => ({ ...current, role: 'client' }))}><span className="role-option-icon">02</span><span><strong>I'm hiring</strong><small>Post a project and review proposals</small></span></button>
        </div>
        <Field label="Your name" id="register-name" type="text" name="name" autoComplete="name" minLength="2" value={form.name} onChange={update} required />
        <Field label="Email address" id="register-email" type="email" name="email" autoComplete="email" value={form.email} onChange={update} required />
        <PasswordField label="Password" id="register-password" name="password" autoComplete="new-password" minLength="8" hint="8+ characters with uppercase, lowercase, number, and a special character." value={form.password} onChange={update} required />
        <Field label={form.role === 'student' ? 'College' : 'College / organization (optional)'} id="register-college" type="text" name="college" autoComplete="organization" value={form.college} onChange={update} required={form.role === 'student'} />
        <Field label="WhatsApp number (optional)" id="register-whatsapp" type="tel" name="whatsappNumber" autoComplete="tel" hint="Include your country code, for example +91..." value={form.whatsappNumber} onChange={update} />
        <Button type="submit" size="large" loading={loading}>Create account</Button>
        <p className="form-legal-note">By continuing, you agree to review our <Link to="/terms">Terms</Link> and <Link to="/privacy-policy">Privacy Policy</Link>.</p>
      </form>
    </AuthPanel>
  )
}
