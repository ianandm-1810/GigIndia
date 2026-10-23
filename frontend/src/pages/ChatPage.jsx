import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, MessageCircle, Paperclip, Send, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import { ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { createSocketClient } from '../services/socketClient.js'
import { getToken } from '../utils/storage.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, getId } from '../utils/format.js'

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message._id, message]))
  incoming.forEach((message) => byId.set(message._id, message))
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export default function ChatPage() {
  const { gigId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [gig, setGig] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('connecting')
  const [typing, setTyping] = useState(false)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const attachmentInputRef = useRef(null)
  const typingTimerRef = useRef(null)

  useEffect(() => {
    let active = true
    const socket = createSocketClient(getToken())
    socketRef.current = socket

    const loadRoom = async () => {
      try {
        const [gigResponse] = await Promise.all([
          apiClient.get('/gigs/' + gigId),
          new Promise((resolve, reject) => {
            socket.once('connect', resolve)
            socket.once('connect_error', reject)
            socket.connect()
          }),
        ])
        if (active) setGig(gigResponse.data)
        socket.emit('joinRoom', gigId, async (result) => {
          if (!active) return
          if (!result?.ok) {
            setError(result?.message || 'You cannot access this gig chat.')
            setJoining(false)
            setLoading(false)
            return
          }
          try {
            const { data } = await apiClient.get('/messages/' + gigId)
            if (active) setMessages(Array.isArray(data) ? data : [])
          } catch (requestError) {
            if (active) setError(getErrorMessage(requestError, 'Could not load chat history.'))
          } finally {
            if (active) {
              setJoining(false)
              setLoading(false)
            }
          }
        })
      } catch (requestError) {
        if (active) {
          setError(getErrorMessage(requestError, 'Could not connect to this gig chat.'))
          setJoining(false)
          setLoading(false)
        }
      }
    }

    const onConnect = () => { if (active) setConnection('connected') }
    const onDisconnect = () => { if (active) setConnection('disconnected') }
    const onMessage = (message) => {
      if (active) setMessages((current) => mergeMessages(current, [message]))
    }
    const onTyping = (data) => {
      if (active && data?.gigId === gigId && getId(data.userId) !== user?._id) {
        setTyping(true)
        window.clearTimeout(typingTimerRef.current)
        typingTimerRef.current = window.setTimeout(() => setTyping(false), 1600)
      }
    }
    const onSocketError = (message) => {
      if (active) showToast(typeof message === 'string' ? message : 'Chat connection error.', 'error')
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('receiveMessage', onMessage)
    socket.on('userTyping', onTyping)
    socket.on('errorMessage', onSocketError)
    loadRoom()

    return () => {
      active = false
      window.clearTimeout(typingTimerRef.current)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('receiveMessage', onMessage)
      socket.off('userTyping', onTyping)
      socket.off('errorMessage', onSocketError)
      socket.disconnect()
      socketRef.current = null
    }
  }, [gigId, showToast, user?._id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, typing])

  function handleTyping(event) {
    setDraft(event.target.value)
    if (event.target.value.trim()) socketRef.current?.emit('typing', { gigId })
  }

  async function submit(event) {
    event.preventDefault()
    const message = draft.trim()
    const socket = socketRef.current
    if ((!message && !attachment) || !socket?.connected || sending) return
    setSending(true)
    try {
      let media = {}
      if (attachment) {
        const formData = new FormData()
        formData.append('gigId', gigId)
        formData.append('message', message)
        formData.append('file', attachment)
        const { data } = await apiClient.post('/upload/chat-media', formData)
        media = { fileUrl: data.fileUrl, mediaType: data.mediaType }
      }
      const result = await new Promise((resolve, reject) => {
        socket.timeout(10000).emit('sendMessage', { gigId, message, ...media }, (timeoutError, response) => {
          if (timeoutError) return reject(new Error('Message was not sent. Check your connection and try again.'))
          if (!response?.ok) return reject(new Error(response?.message || 'Message was not sent.'))
          resolve(response)
        })
      })
      if (result?.ok) {
        setDraft('')
        setAttachment(null)
        if (attachmentInputRef.current) attachmentInputRef.current.value = ''
      }
    } catch (requestError) {
      showToast(getErrorMessage(requestError, 'Message was not sent. Check your connection and try again.'), 'error')
    } finally {
      setSending(false)
    }
  }

  function chooseAttachment(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
    if (!supported.includes(file.type)) {
      showToast('Choose a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.', 'error')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast('Chat images and videos must be 25 MB or smaller.', 'error')
      return
    }
    setAttachment(file)
  }

  const otherName = gig?.client?._id === user?._id || getId(gig?.client) === user?._id
    ? (gig?.assignedTo?.name || 'Student')
    : (gig?.client?.name || 'Client')

  return (
    <div className="content-page chat-page">
      <div className="chat-back-row"><Button to={user?.role === 'client' ? '/client' : '/student'} variant="ghost" size="small"><ArrowLeft size={16} /> Dashboard</Button><span className={'connection-state connection-' + connection}><i />{connection === 'connected' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Reconnecting'}</span></div>
      <section className="chat-card" aria-label="Gig chat">
        <header className="chat-header"><span className="chat-header-icon"><MessageCircle size={20} /></span><div><p className="eyebrow">Project conversation</p><h1>{gig?.title || 'Gig chat'}</h1><p>Chat with {otherName}</p>{gig?.chatAccess?.expiresAt && <p className="chat-retention-note">This room closes {formatDateTime(gig.chatAccess.expiresAt)} (15 days after the gig closed).</p>}</div><Link className="chat-gig-link" to={'/gigs/' + gigId}>View gig</Link></header>
        {loading ? <LoadingState message={joining ? 'Connecting to the private gig room…' : 'Loading messages…'} /> : error ? <ErrorState message={error} action={<Button to={'/gigs/' + gigId} variant="secondary">Back to gig</Button>} /> : (
          <>
            <div className="message-list" aria-live="polite" aria-label="Chat messages">
              {messages.length === 0 && <div className="chat-empty"><span><MessageCircle size={22} /></span><h2>Start the project conversation</h2><p>Keep questions and updates for this gig in one place.</p></div>}
              {messages.map((message) => {
                const ownMessage = getId(message.sender) === user?._id
                const senderName = typeof message.sender === 'object' ? message.sender.name : ownMessage ? user?.name : otherName
                return <article key={message._id} className={'message-row' + (ownMessage ? ' message-own' : '')}><div className="message-bubble"><span className="message-sender">{ownMessage ? 'You' : senderName || otherName}</span>{message.message && <p>{message.message}</p>}{message.fileUrl && message.mediaType === 'image' && <a className="chat-media-link" href={message.fileUrl} target="_blank" rel="noreferrer"><img className="chat-shared-image" src={message.fileUrl} alt="Image shared in the gig chat" loading="lazy" /></a>}{message.fileUrl && message.mediaType === 'video' && <video className="chat-shared-video" src={message.fileUrl} controls preload="metadata">Your browser cannot play this video.</video>}{message.fileUrl && !['image', 'video'].includes(message.mediaType) && <a href={message.fileUrl} target="_blank" rel="noreferrer"><FileText size={16} /> Open shared file</a>}<time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time></div></article>
              })}
              {typing && <div className="typing-indicator" role="status">{otherName} is typing<span className="typing-dots"><i /><i /><i /></span></div>}
              <div ref={bottomRef} />
            </div>
            <form className="chat-composer" onSubmit={submit}>
              <input ref={attachmentInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={chooseAttachment} disabled={connection !== 'connected' || sending} />
              <label className="sr-only" htmlFor="chat-message">Write a message</label>
              <textarea id="chat-message" value={draft} onChange={handleTyping} maxLength="2000" rows="2" placeholder="Write an update or ask a question…" disabled={connection !== 'connected' || sending} />
              {attachment && <div className="chat-attachment-chip"><FileText size={15} /><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" disabled={sending}><X size={15} /></button></div>}
              <div className="chat-composer-footer"><span>{draft.length}/2000 characters · Images/videos up to 25 MB</span><div className="chat-composer-actions"><Button type="button" variant="secondary" size="small" onClick={() => attachmentInputRef.current?.click()} disabled={connection !== 'connected' || sending}><Paperclip size={16} /> Attach</Button><Button type="submit" disabled={(!draft.trim() && !attachment) || connection !== 'connected'} loading={sending}><Send size={16} /> Send</Button></div></div>
              <p className="subtle-note">Messages are visible to the client and the student assigned to this gig. Abusive language, phone numbers, and email addresses are blocked.</p>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
