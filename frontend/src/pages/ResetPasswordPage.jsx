import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AuthPanel from '../components/common/AuthPanel.jsx'
import Button from '../components/common/Button.jsx'
import Field from '../components/common/Field.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiClient.put('/auth/reset-password/' + token, { password })
      navigate('/login', { replace: true, state: { message: 'Password reset. Log in with your new password.' } })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'The reset link may have expired. Request a new one.'))
    } finally { setLoading(false) }
  }

  return (
    <AuthPanel eyebrow="Account recovery" title="Choose a fresh password." description="Create a new password for your GIG INDIA account." footer={<Link to="/forgot-password">Request another reset link</Link>}>
      <div className="auth-form-heading"><p className="eyebrow">Secure your account</p><h2>Reset password</h2><p>Use at least 8 characters, including uppercase, lowercase, a number, and a special character.</p></div>
      <form className="form-stack" onSubmit={submit}>{error && <div className="form-alert" role="alert">{error}</div>}<Field label="New password" id="reset-password" type="password" autoComplete="new-password" minLength="8" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}" value={password} onChange={(event) => setPassword(event.target.value)} required /><Button type="submit" size="large" loading={loading}>Save new password</Button></form>
    </AuthPanel>
  )
}
