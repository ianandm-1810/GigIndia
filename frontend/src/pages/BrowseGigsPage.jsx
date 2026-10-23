import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import Field from '../components/common/Field.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import SelectField from '../components/common/SelectField.jsx'
import GigCard from '../components/features/GigCard.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import apiClient from '../services/apiClient.js'
import { getErrorMessage } from '../utils/errors.js'

const categories = ['design', 'video', 'coding', 'writing', 'social-media', 'data-entry', 'other']

export default function BrowseGigsPage() {
  const [gigs, setGigs] = useState([])
  const [filters, setFilters] = useState({ category: '', minBudget: '', maxBudget: '', search: '' })
  const [applied, setApplied] = useState({ category: '', minBudget: '', maxBudget: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    apiClient.get('/gigs', { params: { ...applied, includeClosed: true } })
      .then(({ data }) => { if (active) setGigs(Array.isArray(data) ? data : []) })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'We could not load gigs right now.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applied, reload])

  const visibleGigs = useMemo(() => {
    const phrase = filters.search.trim().toLowerCase()
    if (!phrase) return gigs
    return gigs.filter((gig) => (gig.title + ' ' + gig.description + ' ' + gig.category).toLowerCase().includes(phrase))
      .sort((left, right) => Number(right.status === 'open') - Number(left.status === 'open') || new Date(right.createdAt) - new Date(left.createdAt))
  }, [gigs, filters.search])

  function update(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }
  function applyFilters(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setApplied({ category: filters.category, minBudget: filters.minBudget, maxBudget: filters.maxBudget })
  }

  return (
    <div className="content-page">
      <PageHeading eyebrow="Find your next project" title="Gigs, past and present." description="Browse open projects and past listings for inspiration. Closed gigs remain visible for reference, but only open gigs accept proposals." />
      <form className="filter-panel" onSubmit={applyFilters}>
        <div className="search-field-wrap"><Search size={18} aria-hidden="true" /><input aria-label="Search loaded gigs" name="search" value={filters.search} onChange={update} placeholder="Search by skill or project" /></div>
        <SelectField label="Category" id="gig-category" name="category" value={filters.category} onChange={update}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category.replaceAll('-', ' ')}</option>)}</SelectField>
        <Field label="Min ₹" id="gig-min" type="number" inputMode="numeric" name="minBudget" min="0" value={filters.minBudget} onChange={update} />
        <Field label="Max ₹" id="gig-max" type="number" inputMode="numeric" name="maxBudget" min="0" value={filters.maxBudget} onChange={update} />
        <Button type="submit"><SlidersHorizontal size={16} /> Apply</Button>
      </form>
      <div className="results-heading"><p>{loading ? 'Finding gigs…' : visibleGigs.length + (visibleGigs.length === 1 ? ' listing' : ' listings')} <span>including past gigs</span></p></div>
      {loading ? <LoadingState message="Loading gigs and past listings..." /> : error ? <ErrorState message={error} action={<Button variant="secondary" type="button" onClick={() => { setLoading(true); setError(''); setReload((count) => count + 1) }}>Try again</Button>} /> : visibleGigs.length === 0 ? <EmptyState title="No gigs match those filters" message="Try a different keyword or clear some filters to see more listings." action={<Button variant="secondary" type="button" onClick={() => { setFilters({ category: '', minBudget: '', maxBudget: '', search: '' }); setLoading(true); setApplied({ category: '', minBudget: '', maxBudget: '' }) }}>Clear filters</Button>} /> : <div className="gig-grid">{visibleGigs.map((gig) => <GigCard gig={gig} key={gig._id} />)}</div>}
    </div>
  )
}
