import { useEffect, useState } from 'react'
import { AlertCircle, Image as ImageIcon, LoaderCircle, MessageSquare, Video, X } from 'lucide-react'
import apiClient from '../../services/apiClient.js'
import { getErrorMessage } from '../../utils/errors.js'
import { formatDateTime } from '../../utils/format.js'

export default function AdminChatViewer({ gig, onClose }) {
  const [messages, setMessages] = useState([])
  const [page, setPage] = useState(1)
  const [hasOlder, setHasOlder] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState('')
  const [chatAccess, setChatAccess] = useState(null)

  useEffect(() => {
    let active = true
    apiClient.get(`/admin/gigs/${gig._id}/messages`, { params: { page: 1, limit: 50 } })
      .then(({ data }) => {
        if (!active) return
        setMessages(data.messages || [])
        setPage(1)
        setHasOlder((data.total || 0) > (data.messages || []).length)
        setChatAccess(data.chatAccess)
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load this gig chat.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gig._id])

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function loadOlder() {
    const nextPage = page + 1
    setLoadingOlder(true)
    setError('')
    try {
      const { data } = await apiClient.get(`/admin/gigs/${gig._id}/messages`, { params: { page: nextPage, limit: 50 } })
      setMessages((current) => [...(data.messages || []), ...current])
      setPage(nextPage)
      setHasOlder(nextPage * (data.limit || 50) < (data.total || 0))
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load older messages.'))
    } finally {
      setLoadingOlder(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-chat-modal" role="dialog" aria-modal="true" aria-labelledby="admin-chat-title">
        <header className="admin-chat-modal-heading">
          <div className="admin-chat-title-icon"><MessageSquare size={18} /></div>
          <div><p className="eyebrow">Admin chat review</p><h2 id="admin-chat-title">{gig.title}</h2><p>Read-only access · {chatAccess?.available ? 'Participant chat is active' : 'Participant chat retention expired'}</p></div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close chat viewer"><X size={18} /></button>
        </header>
        {chatAccess?.expiresAt && <p className="admin-chat-retention">Participants can access this room until {formatDateTime(chatAccess.expiresAt)}. Admin review can access the retained history.</p>}
        <div className="admin-chat-message-list" aria-live="polite">
          {loading ? <p className="admin-chat-status"><LoaderCircle size={18} className="spin" /> Loading chat history…</p> : error && messages.length === 0 ? <p className="admin-chat-status"><AlertCircle size={17} /> {error}</p> : messages.length === 0 ? <p className="admin-chat-status">No messages have been sent in this gig chat.</p> : <>
            {hasOlder && <button type="button" className="admin-load-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? <LoaderCircle size={15} className="spin" /> : null}Load older messages</button>}
            {error && <p className="admin-chat-inline-error">{error}</p>}
            {messages.map((message) => (
              <article className="admin-chat-message" key={message._id}>
                <div className="admin-chat-message-meta"><strong>{message.sender?.name || 'Removed user'}</strong><span>{message.sender?.role || 'member'}</span><time>{formatDateTime(message.createdAt)}</time></div>
                {message.message && <p>{message.message}</p>}
                {message.fileUrl && message.mediaType === 'image' && <a className="admin-chat-media-link" href={message.fileUrl} target="_blank" rel="noreferrer"><img src={message.fileUrl} alt="Image shared in this gig chat" /><span><ImageIcon size={14} /> Open image</span></a>}
                {message.fileUrl && message.mediaType === 'video' && <div className="admin-chat-video-wrap"><video src={message.fileUrl} controls preload="metadata" /><span><Video size={14} /> Video shared in this gig chat</span></div>}
              </article>
            ))}
          </>}
        </div>
        <footer className="admin-chat-modal-footer"><span>Messages are shown for support, safety, and dispute review.</span><button type="button" className="button button-secondary button-small" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  )
}
