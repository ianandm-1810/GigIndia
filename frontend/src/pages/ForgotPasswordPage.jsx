import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthPanel from '../components/common/AuthPanel.jsx'
import Button from '../components/common/Button.jsx'
import Field from '../components/common/Field.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

// Render Free may need close to a minute to wake after being idle.
const RESET_REQUEST_TIMEOUT_MS = 90000

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiClient.post('/auth/forgot-password', { email }, { timeout: RESET_REQUEST_TIMEOUT_MS })
      setSent(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not send the reset email.'))
    } finally { setLoading(false) }
  }

  return (
    <AuthPanel eyebrow="Account recovery" title="Get back to your work." description="We’ll send a password reset link to the email address on your account." footer={<Link to="/login">Back to log in</Link>}>
      <div className="auth-form-heading"><p className="eyebrow">Password help</p><h2>Forgot password?</h2><p>Enter the email you used to create your account.</p></div>
      {sent ? <div className="success-panel" role="status"><strong>Check your inbox</strong><p>If the email belongs to a GIG INDIA account, a reset link has been sent. The link expires in 10 minutes.</p></div> : <form className="form-stack" onSubmit={submit}>{error && <div className="form-alert" role="alert">{error}</div>}<Field label="Email address" id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Button type="submit" size="large" loading={loading}>Send reset link</Button></form>}
    </AuthPanel>
  )
}
