const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MANUAL_REFRESH_GAP_MS = 60 * 1000;

let cachedFeed = null;
let cachedUntil = 0;
let lastRefreshAt = 0;
let refreshInFlight = null;
let linkedInInFlight = null;

const isWebUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
  return response.json();
}

async function getHackerNewsItems(endpoint, limit) {
  const ids = await fetchJson(`https://hacker-news.firebaseio.com/v0/${endpoint}.json`);
  const selectedIds = Array.isArray(ids) ? ids.slice(0, limit) : [];
  const items = await Promise.all(selectedIds.map(async (id) => {
    try {
      return await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    } catch {
      return null;
    }
  }));
  return items.filter((item) => item && !item.dead && !item.deleted && item.type === "story" && item.title && item.url)
    .map((item) => ({
      id: `hn-${item.id}`,
      title: item.title,
      url: item.url,
      source: "Hacker News",
      publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
      commentsUrl: `https://news.ycombinator.com/item?id=${item.id}`,
      points: Number(item.score) || 0
    })).filter((item) => isWebUrl(item.url) && isWebUrl(item.commentsUrl));
}

async function getDevArticles(tag, limit = 8) {
  const url = new URL("https://dev.to/api/articles");
  url.searchParams.set("tag", tag);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("top", "7");
  const articles = await fetchJson(url.toString(), {
    Accept: "application/vnd.forem.api-v1+json",
    "User-Agent": "GIG-INDIA-Tech-Pulse/1.0"
  });
  return (Array.isArray(articles) ? articles : []).map((article) => ({
    id: `devto-${tag}-${article.id}`,
    title: article.title,
    description: article.description || "",
    url: article.url,
    source: "DEV Community",
    publishedAt: article.published_at || article.edited_at || null,
    author: article.user?.name || "",
    reactions: Number(article.public_reactions_count) || 0,
    commentsUrl: article.url
  })).filter((article) => article.title && isWebUrl(article.url));
}

function toIsoDate(value) {
  if (!value) return null;
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function shortText(value, maxLength = 240) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function getLumaRows(payload) {
  const data = payload?.data || payload;
  const rows = data?.entries || data?.events || data?.items || [];
  return Array.isArray(rows) ? rows : [];
}

async function getLumaEvents(limit = 15) {
  const apiKey = process.env.LUMA_API_KEY?.trim();
  if (!apiKey) return { configured: false, available: false, events: [] };

  const now = new Date();
  const after = now.toISOString();
  const before = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://public-api.luma.com/v1/calendars/events/list");
  url.searchParams.set("after", after);
  url.searchParams.set("before", before);
  url.searchParams.set("pagination_limit", "50");
  url.searchParams.set("sort_column", "start_at");
  url.searchParams.set("sort_direction", "asc");
  url.searchParams.set("status", "approved");
  url.searchParams.append("platforms", "luma");
  url.searchParams.append("platforms", "external");
  url.searchParams.append("access", "manage");
  url.searchParams.append("access", "view");

  const payload = await fetchJson(url.toString(), { "x-luma-api-key": apiKey });
  const events = getLumaRows(payload).map((row) => row.event || row).map((event) => {
    const id = event.api_id || event.id || event.event_id || event.url_slug;
    const rawEventUrl = event.url || event.event_url || event.external_url || event.luma_url || "";
    const eventUrl = isWebUrl(rawEventUrl)
      ? rawEventUrl
      : rawEventUrl && /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(rawEventUrl.trim())
        ? `https://${rawEventUrl.trim()}`
        : rawEventUrl
          ? `https://luma.com/${rawEventUrl.trim().replace(/^\/+/, "")}`
          : event.url_slug ? `https://luma.com/${event.url_slug}` : id ? `https://luma.com/event/${id}` : "";
    const locationInfo = event.geo_address_info || event.location || {};
    const location = typeof locationInfo === "string"
      ? locationInfo
      : [locationInfo.venue, locationInfo.city, locationInfo.region, locationInfo.country]
        .filter(Boolean).join(", ") || (event.meeting_url ? "Online" : "");
    let source = "Luma";
    try {
      const host = new URL(eventUrl).hostname.toLowerCase();
      if (host.includes("devpost.com")) source = "Devpost";
      else if (!host.endsWith("luma.com") && !host.endsWith("lu.ma")) source = "External event";
    } catch {
      // Invalid links are filtered below.
    }

    return {
      id: `luma-${id || eventUrl}`,
      title: event.name || event.title || "Upcoming tech event",
      description: shortText(event.description || event.description_md || "", 240),
      url: eventUrl,
      source,
      startsAt: toIsoDate(event.start_at || event.startAt || event.start_time),
      location: shortText(location, 100),
      publishedAt: null
    };
  }).filter((event) => event.title && event.startsAt && new Date(event.startsAt) >= now && isWebUrl(event.url));

  return { configured: true, available: true, events: events.slice(0, limit) };
}

function linkedInConfiguration() {
  const organizations = (process.env.LINKEDIN_ORGANIZATION_URNS || "")
    .split(",").map((value) => value.trim()).filter(Boolean).slice(0, 3);
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const version = process.env.LINKEDIN_API_VERSION?.trim();
  return { organizations, token, version, configured: Boolean(token && version && organizations.length) };
}

async function fetchLinkedInPosts(limit = 15) {
  const config = linkedInConfiguration();
  if (!config.configured) return { configured: false, available: false, posts: [] };

  const responses = await Promise.allSettled(config.organizations.map(async (organizationUrn) => {
    const url = new URL("https://api.linkedin.com/rest/posts");
    url.searchParams.set("q", "author");
    url.searchParams.set("author", organizationUrn);
    url.searchParams.set("count", "10");
    url.searchParams.set("sortBy", "LAST_MODIFIED");
    const payload = await fetchJson(url.toString(), {
      Authorization: `Bearer ${config.token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": config.version
    });
    return Array.isArray(payload.elements) ? payload.elements : [];
  }));

  const successfulResponses = responses.filter((response) => response.status === "fulfilled");
  const posts = successfulResponses.flatMap((response) => response.value).map((post) => {
    const text = shortText(post.commentary || post.content?.article?.title || post.content?.media?.title || "", 420);
    const title = shortText(text, 150) || "LinkedIn technology update";
    const postId = post.id || post.urn;
    const url = post.permalink || post.shareUrl || post.url || (postId
      ? `https://www.linkedin.com/feed/update/${postId}`
      : "");
    return {
      id: `linkedin-${postId || post.createdAt || title}`,
      title,
      description: text.length > 150 ? text : "",
      url,
      source: "LinkedIn",
      author: "Authorized LinkedIn organization",
      publishedAt: toIsoDate(post.createdAt || post.lastModifiedAt),
      commentsUrl: ""
    };
  }).filter((post) => post.title && isWebUrl(post.url))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  return {
    configured: true,
    available: successfulResponses.length > 0,
    posts: posts.slice(0, limit)
  };
}

function getLinkedInPosts(limit = 15) {
  if (!linkedInInFlight) {
    linkedInInFlight = fetchLinkedInPosts(limit).finally(() => { linkedInInFlight = null; });
  }
  return linkedInInFlight;
}

async function getTechTrends() {
  const windowDays = 30;
  const today = Date.now();
  const currentStart = new Date(today - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const previousStart = new Date(today - 2 * windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const makeSearchUrl = (query) => {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "30");
    return url.toString();
  };
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "GIG-INDIA-Tech-Pulse/1.0"
  };
  const [currentResponse, previousResponse] = await Promise.all([
    fetchJson(makeSearchUrl(`created:>${currentStart}`), headers),
    fetchJson(makeSearchUrl(`created:>${previousStart} created:<${currentStart}`), headers)
  ]);
  const repositories = Array.isArray(currentResponse.items) ? currentResponse.items : [];
  const previousRepositories = Array.isArray(previousResponse.items) ? previousResponse.items : [];
  const fields = [
    { name: "AI & machine learning", terms: ["ai", "machine-learning", "deep-learning", "llm", "generative-ai"] },
    { name: "Web & apps", terms: ["web", "web-development", "react", "nextjs", "frontend", "javascript", "typescript"] },
    { name: "Cloud & developer tools", terms: ["cloud", "devops", "kubernetes", "docker", "developer-tools", "cli"] },
    { name: "Cybersecurity", terms: ["security", "cybersecurity", "infosec"] },
    { name: "Data & databases", terms: ["data-science", "data-engineering", "database", "analytics"] }
  ];
  const countFields = (repoList) => fields.map((field) => repoList.filter((repo) => {
      const topics = Array.isArray(repo.topics) ? repo.topics : [];
      const searchable = [repo.name, repo.description, repo.language, ...topics].filter(Boolean).join(" ").toLowerCase();
      return field.terms.some((term) => term.length <= 2
        ? new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, "i").test(searchable)
        : searchable.includes(term));
    }).length);
  const currentCounts = countFields(repositories);
  const previousCounts = countFields(previousRepositories);
  const categories = fields.map((field, index) => ({
    name: field.name,
    count: currentCounts[index],
    previousCount: previousCounts[index],
    change: currentCounts[index] - previousCounts[index]
  }));
  const languageCounts = new Map();
  for (const repo of repositories) {
    if (repo.language) languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1);
  }
  return {
    windowDays,
    sampleSize: repositories.length,
    previousSampleSize: previousRepositories.length,
    categories,
    languages: [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    repositories: repositories.slice(0, 20).map((repo) => ({
      id: repo.id,
      name: repo.full_name,
      description: repo.description || "No description provided",
      language: repo.language || "Not specified",
      stars: Number(repo.stargazers_count) || 0,
      url: repo.html_url,
      createdAt: repo.created_at
    })).filter((repo) => isWebUrl(repo.url))
  };
}

async function buildFeed() {
  const [hackerNews, devArticles, hackathonArticles, lumaEvents, techTrends] = await Promise.allSettled([
    getHackerNewsItems("topstories", 8),
    getDevArticles("technology", 8),
    getDevArticles("hackathon", 8),
    getLumaEvents(),
    getTechTrends()
  ]);
  const value = (result) => result.status === "fulfilled" ? result.value : [];
  const articles = [
    ...value(hackerNews),
    ...value(devArticles)
  ].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 15);
  const lumaEventItems = lumaEvents.status === "fulfilled" ? lumaEvents.value.events : [];
  const hackathonPosts = value(hackathonArticles)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const hackathons = [...lumaEventItems, ...hackathonPosts].slice(0, 15);
  const trends = techTrends.status === "fulfilled" ? techTrends.value : null;

  return {
    generatedAt: new Date().toISOString(),
    refreshIntervalMs: CACHE_TTL_MS,
    articles,
    hackathons,
    trends,
    sources: [
      { key: "hacker-news", name: "Hacker News", url: "https://news.ycombinator.com/", available: hackerNews.status === "fulfilled" },
      { key: "devto", name: "DEV Community", url: "https://dev.to/", available: devArticles.status === "fulfilled" },
      { key: "devto-hackathons", name: "DEV Community · Hackathon", url: "https://dev.to/t/hackathon", available: hackathonArticles.status === "fulfilled" },
      { key: "luma", name: "Luma calendar", url: "https://luma.com/discover", configured: lumaEvents.status === "fulfilled" && lumaEvents.value.configured, available: lumaEvents.status === "fulfilled" && lumaEvents.value.available },
      { key: "github", name: "GitHub public repositories", url: "https://github.com/trending", available: techTrends.status === "fulfilled" },
      { key: "devpost", name: "Devpost hackathons", url: "https://devpost.com/hackathons", available: true }
    ]
  };
}

const getInsights = async (req, res) => {
  try {
    const manualRefresh = req.query.refresh === "1";
    const refreshThrottled = manualRefresh && Date.now() - lastRefreshAt < MANUAL_REFRESH_GAP_MS;
    let feed;
    if (cachedFeed && Date.now() < cachedUntil && (!manualRefresh || refreshThrottled)) {
      feed = cachedFeed;
    } else {
      if (!refreshInFlight) {
        lastRefreshAt = Date.now();
        const previousFeed = cachedFeed;
        refreshInFlight = buildFeed()
          .then((newFeed) => {
            const hasFreshItems = newFeed.articles.length > 0 || newFeed.hackathons.length > 0 || Boolean(newFeed.trends?.sampleSize);
            if (hasFreshItems || !cachedFeed) cachedFeed = newFeed;
            cachedUntil = Date.now() + (hasFreshItems ? CACHE_TTL_MS : 60 * 1000);
            return hasFreshItems || !previousFeed ? newFeed : { ...previousFeed, sources: newFeed.sources, isStale: true };
          })
          .finally(() => { refreshInFlight = null; });
      }
      feed = await refreshInFlight;
    }

    const linkedIn = await getLinkedInPosts().catch(() => ({
      configured: Boolean(linkedInConfiguration().configured),
      available: false,
      posts: []
    }));
    const responseFeed = {
      ...feed,
      linkedinPosts: linkedIn.posts,
      sources: [...feed.sources, {
        key: "linkedin",
        name: "LinkedIn organization posts",
        url: "https://www.linkedin.com/search/results/content/?keywords=technology",
        configured: linkedIn.configured,
        available: linkedIn.available
      }]
    };
    res.set("Cache-Control", manualRefresh || linkedIn.configured ? "no-store" : feed.isStale ? "public, max-age=60" : "public, max-age=300");
    return res.json(responseFeed);
  } catch (error) {
    if (cachedFeed) return res.json(cachedFeed);
    return res.status(502).json({ message: "The technology feeds are temporarily unavailable. Please try again shortly." });
  }
};

module.exports = { getInsights };
