import { useState } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import Field from '../components/common/Field.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import SelectField from '../components/common/SelectField.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

const initialForm = { title: '', description: '', category: 'design', budget: '', deadline: '' }
const categoryOptions = ['design', 'video', 'coding', 'writing', 'social-media', 'data-entry', 'other']

export default function PostGigPage() {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await apiClient.post('/gigs', { ...form, budget: Number(form.budget) })
      showToast('Your gig is live and ready for proposals.')
      navigate('/gigs/' + data._id)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not post this gig. Please try again.'))
    } finally { setLoading(false) }
  }

  return (
    <div className="content-page narrow-content">
      <Link className="back-link" to="/client"><ArrowLeft size={16} /> Client dashboard</Link>
      <PageHeading eyebrow="Share a project" title="Post a gig." description="A clear brief helps students decide whether they can do their best work for you." />
      <Card className="form-card">
        <div className="form-card-intro"><span className="form-intro-icon"><FileText size={19} /></span><div><h2>Project details</h2><p>Be specific about the outcome, budget, and timing.</p></div></div>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <Field label="Gig title" id="gig-title" name="title" maxLength="120" value={form.title} onChange={update} placeholder="For example, design a poster for a campus event" required />
          <div className="form-field"><label className="field-label" htmlFor="gig-description">Description</label><textarea className="field-input field-textarea" id="gig-description" name="description" rows="6" maxLength="2000" value={form.description} onChange={update} placeholder="Describe the work, what you will provide, and what a successful delivery looks like." required /><p className="field-hint">{form.description.length}/2000 characters</p></div>
          <div className="form-grid-two"><SelectField label="Category" id="gig-category" name="category" value={form.category} onChange={update}>{categoryOptions.map((category) => <option key={category} value={category}>{category.replaceAll('-', ' ')}</option>)}</SelectField><Field label="Budget (₹)" id="gig-budget" name="budget" type="number" min="100" step="1" inputMode="numeric" value={form.budget} onChange={update} placeholder="e.g. 2500" required /></div>
          <Field label="Deadline" id="gig-deadline" name="deadline" type="date" min={today} value={form.deadline} onChange={update} required />
          <div className="form-note">Once posted, students can send proposals with their price and delivery time. You can review and accept a proposal from the gig page.</div>
          <div className="button-row"><Button type="button" variant="secondary" to="/client">Cancel</Button><Button type="submit" loading={loading}>Publish gig <span aria-hidden="true">↗</span></Button></div>
        </form>
      </Card>
    </div>
  )
}
