import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp, ExternalLink, Newspaper, RefreshCw, Sparkles, Trophy, TrendingUp } from 'lucide-react'
import apiClient from '../../services/apiClient.js'
import { ErrorState, LoadingState } from '../common/StateMessage.jsx'
import { formatDate, formatDateTime } from '../../utils/format.js'
import './TechPulse.css'

const techSources = [
  { name: 'LinkedIn tech search', url: 'https://www.linkedin.com/search/results/content/?keywords=technology' },
  { name: 'GitHub Trending', url: 'https://github.com/trending' },
  { name: 'Luma Discover', url: 'https://luma.com/discover' },
  { name: 'Devpost hackathons', url: 'https://devpost.com/hackathons' },
  { name: 'Devfolio hackathons', url: 'https://devfolio.co/hackathons' },
  { name: 'MLH events', url: 'https://mlh.io/' },
  { name: 'DEV Community', url: 'https://dev.to/' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/' },
]

const VISIBLE_ITEMS = 5

function MoreItemsButton({ total, visibleCount, label, onShowMore, onShowLess }) {
  if (total <= VISIBLE_ITEMS) return null
  const expanded = visibleCount > VISIBLE_ITEMS

  return (
    <button className="tech-pulse-more" type="button" aria-expanded={expanded} onClick={expanded ? onShowLess : onShowMore}>
      {expanded ? `Show fewer ${label}` : `Show all ${total} ${label}`}
      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  )
}

function InsightCard({ item }) {
  const dateValue = item.startsAt || item.publishedAt
  return (
    <article className="tech-pulse-card">
      <div className="tech-pulse-card-meta"><span>{item.source}</span>{dateValue && <time dateTime={dateValue}>{item.startsAt ? `Starts ${formatDateTime(item.startsAt)}` : formatDate(item.publishedAt)}</time>}</div>
      <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}<ExternalLink size={14} /></a></h3>
      {item.description && <p>{item.description}</p>}
      {item.location && <p className="tech-pulse-event-location">{item.location}</p>}
      <div className="tech-pulse-card-foot">
        <span>{item.author || (item.points ? `${item.points} points` : item.reactions ? `${item.reactions} reactions` : 'Tech story')}</span>
        {item.commentsUrl && <a href={item.commentsUrl} target="_blank" rel="noreferrer">Discussion <ArrowUpRight size={13} /></a>}
      </div>
    </article>
  )
}

function TechTrendPanel({ trends, linkedinPosts, linkedinSource, visibleCounts, onShowMore, onShowLess }) {
  if (!trends && !linkedinPosts.length) return <p className="tech-pulse-empty">Technology trend data is temporarily unavailable.</p>
  const maxCount = Math.max(1, ...(trends?.categories || []).map((category) => category.count))
  const visibleLinkedInPosts = linkedinPosts.slice(0, visibleCounts.linkedin)
  const repositories = trends?.repositories || []
  const visibleRepositories = repositories.slice(0, visibleCounts.repositories)
  const linkedInEmptyMessage = !linkedinSource?.configured
    ? 'LinkedIn posts need an approved API connection and organization access.'
    : !linkedinSource.available
      ? 'LinkedIn did not return posts. Check the API token, permissions, and organization URNs.'
      : 'No recent LinkedIn posts are available from the connected organizations.'

  return (
    <div className="tech-pulse-trends">
      {trends ? <>
        <p className="tech-pulse-trend-note">Live signals from GitHub and authorized LinkedIn organization pages. GitHub compares recently created public repositories with the previous {trends.windowDays}-day sample ({trends.sampleSize} current, {trends.previousSampleSize} previous); categories may overlap.</p>
        <div className="tech-pulse-trend-list">{(trends.categories || []).map((category) => <div className="tech-pulse-trend-row" key={category.name}>
          <div><span>{category.name}</span><strong>{category.count} · {category.change > 0 ? '+' : ''}{category.change} vs prior</strong></div>
          <span className="tech-pulse-trend-track"><span style={{ width: `${Math.max(category.count ? 6 : 0, category.count / maxCount * 100)}%` }} /></span>
        </div>)}</div>
        {!!trends.languages?.length && <div className="tech-pulse-trend-languages"><span>Languages in this sample</span>{trends.languages.map((language) => <b key={language.name}>{language.name} · {language.count}</b>)}</div>}
      </> : <p className="tech-pulse-source-note">GitHub’s live repository feed is temporarily unavailable.</p>}
      <div className="tech-pulse-social-feed">
        <div className="tech-pulse-subheading"><strong>LinkedIn updates</strong><a href="https://www.linkedin.com/search/results/content/?keywords=technology" target="_blank" rel="noreferrer">Browse tech posts <ArrowUpRight size={12} /></a></div>
        {visibleLinkedInPosts.length ? <div className="tech-pulse-list">{visibleLinkedInPosts.map((item) => <InsightCard key={item.id} item={item} />)}</div> : <p className="tech-pulse-source-note">{linkedInEmptyMessage}</p>}
        <MoreItemsButton total={linkedinPosts.length} visibleCount={visibleCounts.linkedin} label="LinkedIn updates" onShowMore={() => onShowMore('linkedin', linkedinPosts.length)} onShowLess={() => onShowLess('linkedin')} />
      </div>
      {!!repositories.length && <div className="tech-pulse-trend-projects"><strong>Top-starred recent GitHub repos</strong>{visibleRepositories.map((repo) => <a href={repo.url} target="_blank" rel="noreferrer" key={repo.id}><span><b>{repo.name}</b><small>{repo.description}</small></span><span>{repo.language} · ★ {repo.stars.toLocaleString()} <ExternalLink size={12} /></span></a>)}<MoreItemsButton total={repositories.length} visibleCount={visibleCounts.repositories} label="repositories" onShowMore={() => onShowMore('repositories', repositories.length)} onShowLess={() => onShowLess('repositories')} /></div>}
    </div>
  )
}

export default function TechPulse() {
  const [feed, setFeed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleCounts, setVisibleCounts] = useState({ articles: VISIBLE_ITEMS, hackathons: VISIBLE_ITEMS, linkedin: VISIBLE_ITEMS, repositories: VISIBLE_ITEMS })

  const loadFeed = useCallback(async (quiet = false, forceRefresh = false) => {
    if (!quiet) setLoading(true)
    try {
      const { data } = await apiClient.get('/insights', forceRefresh ? { params: { refresh: 1 } } : undefined)
      setFeed(data)
      setError('')
    } catch {
      setError('Live feeds could not be refreshed right now. Explore the source sites below.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeed()
    const timer = window.setInterval(() => loadFeed(true), 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [loadFeed])

  const articles = feed?.articles || []
  const hackathons = feed?.hackathons || []
  const linkedinPosts = feed?.linkedinPosts || []
  const linkedinSource = feed?.sources?.find((source) => source.key === 'linkedin')

  function showMore(key, total) {
    setVisibleCounts((current) => ({ ...current, [key]: total }))
  }

  function showLess(key) {
    setVisibleCounts((current) => ({ ...current, [key]: VISIBLE_ITEMS }))
  }

  return (
    <section className="tech-pulse-section section-wrap" aria-labelledby="tech-pulse-title">
      <div className="tech-pulse-heading">
        <div><p className="eyebrow"><Sparkles size={14} /> The tech world, updated</p><h2 id="tech-pulse-title">A little feed for your next idea.</h2><p>Current tech stories, hackathon listings, LinkedIn updates, and GitHub activity. Feeds refresh every five minutes.</p></div>
        <button className="tech-pulse-refresh" type="button" onClick={() => loadFeed(false, true)} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
      </div>

      <div className="tech-pulse-columns">
        <section className="tech-pulse-column" aria-labelledby="tech-pulse-stories">
          <div className="tech-pulse-column-heading"><span><Newspaper size={17} /></span><div><h3 id="tech-pulse-stories">Fresh reads</h3><p>Stories from Hacker News and DEV Community</p></div></div>
          {loading && !feed ? <LoadingState message="Loading current tech stories…" /> : error && !articles.length ? <ErrorState message={error} /> : articles.length ? <><div className="tech-pulse-list">{articles.slice(0, visibleCounts.articles).map((item) => <InsightCard key={item.id} item={item} />)}</div><MoreItemsButton total={articles.length} visibleCount={visibleCounts.articles} label="stories" onShowMore={() => showMore('articles', articles.length)} onShowLess={() => showLess('articles')} /></> : <p className="tech-pulse-empty">No stories are available from the feeds right now.</p>}
        </section>

        <section className="tech-pulse-column" aria-labelledby="tech-pulse-hackathons">
          <div className="tech-pulse-column-heading"><span><Trophy size={17} /></span><div><h3 id="tech-pulse-hackathons">Hackathons & builds</h3><p>Luma calendar events and developer community posts</p></div></div>
          {loading && !feed ? <LoadingState message="Loading hackathons and builds…" /> : error && !hackathons.length ? <ErrorState message={error} /> : hackathons.length ? <><div className="tech-pulse-list">{hackathons.slice(0, visibleCounts.hackathons).map((item) => <InsightCard key={item.id} item={item} />)}</div><MoreItemsButton total={hackathons.length} visibleCount={visibleCounts.hackathons} label="events and builds" onShowMore={() => showMore('hackathons', hackathons.length)} onShowLess={() => showLess('hackathons')} /></> : <p className="tech-pulse-empty">No current hackathon or build posts are available.</p>}
        </section>

        <section className="tech-pulse-column" aria-labelledby="tech-pulse-trends">
          <div className="tech-pulse-column-heading"><span><TrendingUp size={17} /></span><div><h3 id="tech-pulse-trends">What’s moving in tech</h3><p>LinkedIn posts and GitHub signals</p></div></div>
          {loading && !feed ? <LoadingState message="Loading technology signals…" /> : error && !feed?.trends ? <ErrorState message={error} /> : <TechTrendPanel trends={feed?.trends} linkedinPosts={linkedinPosts} linkedinSource={linkedinSource} visibleCounts={visibleCounts} onShowMore={showMore} onShowLess={showLess} />}
        </section>
      </div>

      <div className="tech-pulse-discover"><div><strong>Explore the original sources</strong><span>Open the publisher or event platform for full details and registration.</span></div><div className="tech-pulse-board-links">{techSources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.name}>{source.name} <ArrowUpRight size={13} /></a>)}</div></div>
      {error && (articles.length > 0 || hackathons.length > 0 || feed?.trends) && <p className="tech-pulse-update-error" role="status">{error}</p>}
      {feed?.isStale && <p className="tech-pulse-update-error" role="status">Some sources are unavailable. Showing the last saved feed while they recover.</p>}
      <p className="tech-pulse-attribution">Stories and events link to their original sources. GitHub signals are a directional sample of public repositories, not an industry-wide measure. Feed snapshot: {feed?.generatedAt ? formatDateTime(feed.generatedAt) : 'not available'}.</p>
    </section>
  )
}
