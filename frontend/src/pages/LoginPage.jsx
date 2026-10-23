import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthPanel from '../components/common/AuthPanel.jsx'
import Button from '../components/common/Button.jsx'
import Field from '../components/common/Field.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getErrorMessage } from '../utils/errors.js'

export default function LoginPage() {
  const { login } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form)
      showToast('Welcome back, ' + user.name + '.')
      navigate(location.state?.from || (user.role === 'client' ? '/client' : user.role === 'admin' ? '/admin' : '/student'), { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not log in. Check your details and try again.'))
    } finally { setLoading(false) }
  }

  return (
    <AuthPanel eyebrow="Welcome back" title="Your next chapter is waiting." description="Sign in to pick up where you left off and keep your work moving." footer={<>New to GIG INDIA? <Link to="/register">Create your account</Link></>}>
      <div className="auth-form-heading"><p className="eyebrow">Account access</p><h2>Log in</h2><p>Use the email and password for your GIG INDIA account.</p></div>
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <Field label="Email address" id="login-email" type="email" name="email" autoComplete="email" value={form.email} onChange={update} required />
        <Field label="Password" id="login-password" type="password" name="password" autoComplete="current-password" value={form.password} onChange={update} required />
        <div className="form-inline-link"><Link to="/forgot-password">Forgot password?</Link></div>
        <Button type="submit" size="large" loading={loading}>Log in</Button>
      </form>
    </AuthPanel>
  )
}
