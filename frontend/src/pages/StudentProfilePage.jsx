import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Link as LinkIcon, Star, UserRound } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

const socialItems = [
  ['github', 'GitHub', LinkIcon],
  ['linkedin', 'LinkedIn', LinkIcon],
  ['instagram', 'Instagram', LinkIcon],
  ['discord', 'Discord', LinkIcon],
]

export default function StudentProfilePage() {
  const { username } = useParams()
  const [searchParams] = useSearchParams()
  const gigId = searchParams.get('gigId')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!gigId) {
      setError('Open this profile from a proposal on one of your gigs.')
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    apiClient.get('/proposals/' + encodeURIComponent(gigId) + '/student/' + encodeURIComponent(username))
      .then(({ data }) => { if (active) { setProfile(data); setError('') } })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'This profile is available only to a client who received this student’s application.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gigId, username])

  if (loading) return <div className="content-page"><LoadingState message="Loading applicant profile…" /></div>
  if (error || !profile) return <div className="content-page"><ErrorState message={error || 'Student profile unavailable.'} action={<Button to={gigId ? '/gigs/' + gigId : '/client'} variant="secondary">Back to gig</Button>} /></div>

  const student = profile.student
  return (
    <div className="content-page student-profile-page">
      <Link className="back-link" to={'/gigs/' + profile.gig._id}><ArrowLeft size={16} /> Back to {profile.gig.title}</Link>
      <PageHeading eyebrow="Selected student" title={student.name} description={'Full profile for the student selected for “' + profile.gig.title + '”.'} />
      <div className="student-profile-grid">
        <Card className="student-public-card">
          <div className="student-public-identity">
            {student.profilePhoto ? <img src={student.profilePhoto} alt={student.name + ' profile'} /> : <span className="student-public-avatar"><UserRound size={28} /></span>}
            <div><h2>{student.name}</h2><p>@{student.username}</p>{student.college && <span>{student.college}</span>}</div>
          </div>
          <div className="student-public-rating"><Star size={16} fill="currentColor" /><strong>{Number(student.rating || 0).toFixed(1)}</strong><span>{student.totalReviews || 0} reviews</span></div>
          <section className="student-public-section"><h3>About</h3><p>{student.bio || 'This student has not added an About description yet.'}</p></section>
          {student.skills?.length > 0 && <section className="student-public-section"><h3>Skills</h3><div className="skill-list">{student.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>}
          {(student.portfolioLink || socialItems.some(([key]) => student.socialLinks?.[key])) && <section className="student-public-section"><h3>Links</h3><div className="student-profile-links">
            {student.portfolioLink && <a href={student.portfolioLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Portfolio website</a>}
            {socialItems.map(([key, label, Icon]) => student.socialLinks?.[key] && <a href={student.socialLinks[key]} key={key} target="_blank" rel="noreferrer"><Icon size={16} /> {label}</a>)}
          </div></section>}
        </Card>

        <Card className="student-public-portfolio">
          <p className="eyebrow">Work samples</p><h2>Uploaded portfolio</h2>
          {student.portfolio?.length ? <ul className="portfolio-list">{student.portfolio.map((fileUrl, index) => <li key={fileUrl}><span className="portfolio-file-icon"><ExternalLink size={17} /></span><a href={fileUrl} target="_blank" rel="noreferrer">Portfolio sample {index + 1}<ExternalLink size={14} /></a></li>)}</ul> : <div className="portfolio-empty"><span><LinkIcon size={20} /></span><h3>No uploaded samples yet</h3><p>The student has not uploaded portfolio files.</p></div>}
          <p className="subtle-note">This profile is visible because you accepted this student's proposal. It does not include their email or phone number.</p>
        </Card>
      </div>
    </div>
  )
}
