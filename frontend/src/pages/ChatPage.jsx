import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, MessageCircle, Send } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('connecting')
  const [typing, setTyping] = useState(false)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)
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

  function submit(event) {
    event.preventDefault()
    const message = draft.trim()
    const socket = socketRef.current
    if (!message || !socket?.connected || sending) return
    setSending(true)
    socket.timeout(10000).emit('sendMessage', { gigId, message }, (timeoutError, result) => {
      setSending(false)
      if (timeoutError || !result?.ok) {
        showToast(result?.message || 'Message was not sent. Check your connection and try again.', 'error')
        return
      }
      setDraft('')
    })
  }

  const otherName = gig?.client?._id === user?._id || getId(gig?.client) === user?._id
    ? (gig?.assignedTo?.name || 'Student')
    : (gig?.client?.name || 'Client')

  return (
    <div className="content-page chat-page">
      <div className="chat-back-row"><Button to={user?.role === 'client' ? '/client' : '/student'} variant="ghost" size="small"><ArrowLeft size={16} /> Dashboard</Button><span className={'connection-state connection-' + connection}><i />{connection === 'connected' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Reconnecting'}</span></div>
      <section className="chat-card" aria-label="Gig chat">
        <header className="chat-header"><span className="chat-header-icon"><MessageCircle size={20} /></span><div><p className="eyebrow">Project conversation</p><h1>{gig?.title || 'Gig chat'}</h1><p>Chat with {otherName}</p></div><Link className="chat-gig-link" to={'/gigs/' + gigId}>View gig</Link></header>
        {loading ? <LoadingState message={joining ? 'Connecting to the private gig room…' : 'Loading messages…'} /> : error ? <ErrorState message={error} action={<Button to={'/gigs/' + gigId} variant="secondary">Back to gig</Button>} /> : (
          <>
            <div className="message-list" aria-live="polite" aria-label="Chat messages">
              {messages.length === 0 && <div className="chat-empty"><span><MessageCircle size={22} /></span><h2>Start the project conversation</h2><p>Keep questions and updates for this gig in one place.</p></div>}
              {messages.map((message) => {
                const ownMessage = getId(message.sender) === user?._id
                const senderName = typeof message.sender === 'object' ? message.sender.name : ownMessage ? user?.name : otherName
                return <article key={message._id} className={'message-row' + (ownMessage ? ' message-own' : '')}><div className="message-bubble"><span className="message-sender">{ownMessage ? 'You' : senderName || otherName}</span>{message.message && <p>{message.message}</p>}{message.fileUrl && <a href={message.fileUrl} target="_blank" rel="noreferrer"><FileText size={16} /> Open shared file</a>}<time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time></div></article>
              })}
              {typing && <div className="typing-indicator" role="status">{otherName} is typing<span className="typing-dots"><i /><i /><i /></span></div>}
              <div ref={bottomRef} />
            </div>
            <form className="chat-composer" onSubmit={submit}>
              <label className="sr-only" htmlFor="chat-message">Write a message</label>
              <textarea id="chat-message" value={draft} onChange={handleTyping} maxLength="2000" rows="2" placeholder="Write an update or ask a question…" disabled={connection !== 'connected'} />
              <div className="chat-composer-footer"><span>{draft.length}/2000 characters</span><Button type="submit" disabled={!draft.trim() || connection !== 'connected'} loading={sending}><Send size={16} /> Send</Button></div>
              <p className="subtle-note">Messages are visible to the client and the student assigned to this gig.</p>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
