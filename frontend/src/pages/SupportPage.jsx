import { Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import Field from '../components/common/Field.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

const whatsappNumber = (import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || '').replace(/\D/g, '')
const whatsappLink = whatsappNumber.length >= 8 && whatsappNumber.length <= 15
  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi GIG INDIA Support, I need help with: ')}`
  : ''

export default function SupportPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: ['student', 'client'].includes(user?.role) ? user.role : 'student',
    topic: 'Account access',
    message: '',
  })
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiClient.post('/support', form)
      setSent(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not send your request. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content-page support-page">
      <header className="page-heading support-heading">
        <div>
          <p className="eyebrow">Here for students and clients</p>
          <h1>Talk to GIG INDIA.</h1>
          <p className="page-lede">Need help with an account, a gig, or your private project chat? Send us a message and our support team will get back to you.</p>
        </div>
      </header>

      <div className="support-layout">
        <section className="support-contact-column" aria-label="Contact options">
          <article className="support-contact-card">
            <span className="support-icon"><MessageCircle size={20} /></span>
            <p className="eyebrow">WhatsApp</p>
            <h2>Chat with support</h2>
            {whatsappLink ? (
              <>
                <p>Open a WhatsApp conversation with GIG INDIA Support. Please don’t share passwords or payment secrets in chat.</p>
                <a className="button button-primary button-medium support-whatsapp-button" href={whatsappLink} target="_blank" rel="noreferrer">Message us on WhatsApp <span aria-hidden="true">↗</span></a>
              </>
            ) : (
              <p>WhatsApp support will appear here once GIG INDIA’s public WhatsApp Business number is configured.</p>
            )}
          </article>

          <article className="support-contact-card support-email-note">
            <span className="support-icon"><Mail size={20} /></span>
            <p className="eyebrow">Email</p>
            <h2>Send a support request</h2>
            <p>Use the form and we’ll route your message to the GIG INDIA support inbox.</p>
          </article>

          <p className="support-privacy-note"><ShieldCheck size={17} /><span>Your request is sent privately to our support inbox. Project work and files should stay in the gig’s private chat.</span></p>
        </section>

        <section className="support-form-card" aria-labelledby="support-form-title">
          <div className="support-form-heading">
            <p className="eyebrow">We’ll help you sort it out</p>
            <h2 id="support-form-title">How can we help?</h2>
          </div>
          {sent ? (
            <div className="success-panel" role="status"><Mail size={20} /><div><strong>Message sent</strong><p>Thanks for contacting GIG INDIA. Our support team will reply to the email address you provided.</p><Link to="/">Back to GIG INDIA</Link></div></div>
          ) : (
            <form className="form-stack" onSubmit={submit}>
              {error && <div className="form-alert" role="alert">{error}</div>}
              <Field label="Your name" id="support-name" name="name" autoComplete="name" value={form.name} onChange={updateField} minLength={2} maxLength={100} required />
              <Field label="Email address" id="support-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} required />
              <div className="support-form-row">
                <div className="form-field">
                  <label className="field-label" htmlFor="support-role">I’m using GIG INDIA as</label>
                  <select className="field-input" id="support-role" name="role" value={form.role} onChange={updateField}>
                    <option value="student">Student</option>
                    <option value="client">Client</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="support-topic">What do you need help with?</label>
                  <select className="field-input" id="support-topic" name="topic" value={form.topic} onChange={updateField}>
                    <option>Account access</option>
                    <option>Gig or proposal</option>
                    <option>Private chat</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="support-message">Message</label>
                <textarea className="field-input support-message-input" id="support-message" name="message" rows="6" minLength={15} maxLength={4000} value={form.message} onChange={updateField} placeholder="Tell us what happened and how we can help…" required />
                <p className="field-hint">Please don’t include passwords, OTPs, or bank details.</p>
              </div>
              <Button type="submit" size="large" loading={loading}><Mail size={16} /> Send to support</Button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
