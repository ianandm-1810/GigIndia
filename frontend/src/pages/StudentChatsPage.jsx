import { useEffect, useRef, useState } from 'react'
import { ImagePlus, MessageCircle, Search, Send, ShieldCheck, Video, X } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import PageHeading from '../components/common/PageHeading.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import apiClient from '../services/apiClient.js'
import { createSocketClient } from '../services/socketClient.js'
import { getToken } from '../utils/storage.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, getId } from '../utils/format.js'

function mergeMessages(current, incoming) {
  const messagesById = new Map(current.map((message) => [message._id, message]))
  incoming.forEach((message) => messagesById.set(message._id, message))
  return [...messagesById.values()].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
}

export default function StudentChatsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [conversations, setConversations] = useState([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const selectedConversation = conversations.find((conversation) => conversation._id === selectedId)
  const [messages, setMessages] = useState([])
  const [messagesPage, setMessagesPage] = useState(1)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const fileInput = useRef(null)
  const bottomRef = useRef(null)
  const skipAutoScrollRef = useRef(false)

  async function refreshConversations() {
    const { data } = await apiClient.get('/student-chats')
    const items = Array.isArray(data.conversations) ? data.conversations : []
    setConversations(items)
    setSelectedId((current) => items.some((item) => item._id === current && item.status === 'accepted') ? current : '')
  }

  useEffect(() => {
    let active = true
    apiClient.get('/student-chats')
      .then(({ data }) => { if (active) setConversations(Array.isArray(data.conversations) ? data.conversations : []) })
      .catch((requestError) => { if (active) setLoadError(getErrorMessage(requestError, 'Could not load your student chats.')) })
      .finally(() => { if (active) setLoadingChats(false) })
    return () => { active = false }
  }, [user?._id])

  useEffect(() => {
    const socket = createSocketClient(getToken())
    const refreshInbox = async () => {
      try {
        const { data } = await apiClient.get('/student-chats')
        setConversations(Array.isArray(data.conversations) ? data.conversations : [])
      } catch (requestError) {
        setLoadError(getErrorMessage(requestError, 'Could not refresh student chat requests.'))
      }
    }
    socket.on('studentChatRequest', () => {
      showToast('You received a student chat request.')
      refreshInbox()
    })
    socket.on('studentChatStatus', refreshInbox)
    socket.connect()
    return () => { socket.disconnect() }
  }, [showToast, user?._id])

  useEffect(() => {
    const username = query.trim().replace(/^@/, '')
    if (username.length < 2) { setSearchResults([]); setSearching(false); return undefined }
    let active = true
    setSearching(true)
    const timer = window.setTimeout(() => {
      apiClient.get('/student-chats/search', { params: { username } })
        .then(({ data }) => { if (active) setSearchResults(data.users || []) })
        .catch((requestError) => { if (active) showToast(getErrorMessage(requestError, 'Could not search students.'), 'error') })
        .finally(() => { if (active) setSearching(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, showToast])

  useEffect(() => {
    if (!selectedConversation || selectedConversation.status !== 'accepted') { setMessages([]); setConnectionError(''); return undefined }
    let active = true
    setMessages([])
    setMessagesPage(1)
    setHasOlderMessages(false)
    const socket = createSocketClient(getToken())
    const onMessage = (message) => { if (active) setMessages((current) => mergeMessages(current, [message])) }
    socket.on('studentChatMessage', onMessage)
    socket.on('connect_error', (error) => { if (active) setConnectionError(error.message || 'Live connection is unavailable. Refresh the room to retry.') })
    apiClient.get(`/student-chats/${selectedConversation._id}/messages`, { params: { page: 1, limit: 50 } })
      .then(({ data }) => { if (active) { setMessages(data.messages || []); setMessagesPage(1); setHasOlderMessages((data.total || 0) > (data.messages || []).length) } })
      .catch((requestError) => { if (active) setConnectionError(getErrorMessage(requestError, 'Could not load this chat.')) })
    socket.once('connect', () => socket.emit('joinStudentChat', selectedConversation._id, (result) => {
      if (active && !result?.ok) setConnectionError(result?.message || 'This chat is unavailable.')
    }))
    socket.connect()
    return () => { active = false; socket.disconnect() }
  }, [selectedConversation?._id, selectedConversation?.status])

  useEffect(() => {
    if (skipAutoScrollRef.current) { skipAutoScrollRef.current = false; return }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function loadOlderMessages() {
    if (!selectedConversation || loadingOlderMessages || !hasOlderMessages) return
    const nextPage = messagesPage + 1
    setLoadingOlderMessages(true)
    try {
      const { data } = await apiClient.get(`/student-chats/${selectedConversation._id}/messages`, { params: { page: nextPage, limit: 50 } })
      skipAutoScrollRef.current = true
      setMessages((current) => mergeMessages(current, data.messages || []))
      setMessagesPage(nextPage)
      setHasOlderMessages(nextPage * (data.limit || 50) < (data.total || 0))
    } catch (requestError) { setConnectionError(getErrorMessage(requestError, 'Could not load older messages.')) }
    finally { setLoadingOlderMessages(false) }
  }

  async function sendRequest(student) {
    setBusyId('request-' + student._id)
    try {
      const { data } = await apiClient.post('/student-chats/requests', { username: student.username })
      showToast(data.message || 'Chat request sent.')
      setQuery('')
      await refreshConversations()
    } catch (requestError) { showToast(getErrorMessage(requestError, 'Could not send this chat request.'), 'error') }
    finally { setBusyId('') }
  }

  async function respond(conversation, action) {
    setBusyId('respond-' + conversation._id)
    try {
      const { data } = await apiClient.patch(`/student-chats/${conversation._id}/respond`, { action })
      showToast(data.message)
      await refreshConversations()
      if (action === 'accept') setSelectedId(conversation._id)
    } catch (requestError) { showToast(getErrorMessage(requestError, 'Could not update this request.'), 'error') }
    finally { setBusyId('') }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!selectedConversation || (!draft.trim() && !attachment)) return
    setSending(true)
    setConnectionError('')
    try {
      let media = {}
      if (attachment) {
        const formData = new FormData()
        formData.append('file', attachment)
        formData.append('conversationId', selectedConversation._id)
        formData.append('message', draft)
        const { data } = await apiClient.post('/upload/chat-media', formData)
        media = { fileUrl: data.fileUrl, mediaType: data.mediaType }
      }
      const { data } = await apiClient.post(`/student-chats/${selectedConversation._id}/messages`, { message: draft, ...media })
      setMessages((current) => mergeMessages(current, [data]))
      setDraft('')
      setAttachment(null)
    } catch (requestError) { setConnectionError(getErrorMessage(requestError, 'Could not send this message.')) }
    finally { setSending(false) }
  }

  function chooseAttachment(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
    if (!supported.includes(file.type)) { showToast('Choose a supported image or video.', 'error'); return }
    if (file.size > 25 * 1024 * 1024) { showToast('Chat media must be 25 MB or smaller.', 'error'); return }
    setAttachment(file)
  }

  const incoming = conversations.filter((item) => item.status === 'pending' && getId(item.recipient) === user?._id)
  const outgoing = conversations.filter((item) => item.status === 'pending' && getId(item.requester) === user?._id)
  const accepted = conversations.filter((item) => item.status === 'accepted')
  const otherMember = (conversation) => conversation.members?.find((member) => getId(member) !== user?._id)

  return <div className="content-page student-chat-page">
    <PageHeading eyebrow="Student community" title="Student chats." description="Find a student by username, request a private chat, and share project advice inside GIG INDIA." />
    <div className="student-chat-privacy"><ShieldCheck size={18} /><p><strong>Your contact details stay private.</strong> Search shows usernames only. Email addresses and phone numbers are not shown or allowed in chat. Admins can review or block student chats for safety.</p></div>
    <div className="student-chat-layout">
      <aside className="student-chat-sidebar">
        <form className="student-chat-search" onSubmit={(event) => event.preventDefault()}><label htmlFor="student-chat-search">Find a student</label><div><Search size={17} /><input id="student-chat-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by username" autoComplete="off" /></div></form>
        {query.trim().length >= 2 && <div className="student-search-results">{searching ? <p>Searching usernames…</p> : searchResults.length ? searchResults.map((student) => <article key={student._id}><span className="student-chat-avatar">{student.profilePhoto ? <img src={student.profilePhoto} alt="" /> : (student.name?.[0] || 'S')}</span><div><strong>{student.name}</strong><small>@{student.username}</small></div><Button size="small" loading={busyId === 'request-' + student._id} onClick={() => sendRequest(student)}>Request</Button></article>) : <p>No student usernames found.</p>}</div>}
        {loadingChats ? <LoadingState message="Loading your student chats…" /> : loadError ? <ErrorState message={loadError} /> : <>
          {incoming.length > 0 && <section className="student-chat-list-section"><h2>Requests for you</h2>{incoming.map((item) => { const sender = item.members?.find((member) => getId(member) === getId(item.requester)); return <article className="student-chat-request" key={item._id}><strong>{sender?.name || 'Student'}</strong><small>@{sender?.username || 'student'} wants to chat</small><div><Button size="small" onClick={() => respond(item, 'accept')} loading={busyId === 'respond-' + item._id}>Accept</Button><Button size="small" variant="danger-ghost" onClick={() => respond(item, 'reject')} loading={busyId === 'respond-' + item._id}>Decline</Button></div></article>})}</section>}
          {outgoing.length > 0 && <section className="student-chat-list-section"><h2>Waiting for a reply</h2>{outgoing.map((item) => { const target = otherMember(item); return <article className="student-chat-request" key={item._id}><strong>{target?.name || 'Student'}</strong><small>@{target?.username || 'student'} · request pending</small></article>})}</section>}
          <section className="student-chat-list-section"><h2>Your chats</h2>{accepted.length ? accepted.map((item) => { const person = otherMember(item); return <button type="button" className={'student-chat-contact' + (selectedId === item._id ? ' selected' : '')} key={item._id} onClick={() => setSelectedId(item._id)}><span className="student-chat-avatar">{person?.profilePhoto ? <img src={person.profilePhoto} alt="" /> : (person?.name?.[0] || 'S')}</span><span><strong>{person?.name || 'Student'}</strong><small>@{person?.username || 'student'}</small></span><MessageCircle size={16} /></button>}) : <p className="student-chat-empty-copy">Accepted student chats will appear here.</p>}</section>
        </>}
      </aside>
      <section className="student-chat-room">
        {selectedConversation ? <>
          <header className="student-chat-room-header"><div><span className="student-chat-avatar">{otherMember(selectedConversation)?.profilePhoto ? <img src={otherMember(selectedConversation).profilePhoto} alt="" /> : (otherMember(selectedConversation)?.name?.[0] || 'S')}</span><div><strong>{otherMember(selectedConversation)?.name || 'Student'}</strong><small>@{otherMember(selectedConversation)?.username || 'student'}</small></div></div><span className="student-chat-private-tag"><ShieldCheck size={14} /> Private chat</span></header>
          <div className="student-chat-messages">{connectionError && <p className="student-chat-inline-error">{connectionError}</p>}{hasOlderMessages && <button type="button" className="admin-load-older" onClick={loadOlderMessages} disabled={loadingOlderMessages}>{loadingOlderMessages ? 'Loading older messages…' : 'Load older messages'}</button>}{messages.length ? messages.map((message) => <article key={message._id} className={'student-chat-message ' + (getId(message.sender) === user?._id ? 'own' : '')}><div className="student-chat-message-meta"><strong>{getId(message.sender) === user?._id ? 'You' : message.sender?.name || 'Student'}</strong><time>{formatDateTime(message.createdAt)}</time></div>{message.message && <p>{message.message}</p>}{message.fileUrl && message.mediaType === 'image' && <a href={message.fileUrl} target="_blank" rel="noreferrer"><img src={message.fileUrl} alt="Shared in student chat" /></a>}{message.fileUrl && message.mediaType === 'video' && <video src={message.fileUrl} controls preload="metadata" />} </article>) : !connectionError && <EmptyState title="Start the conversation" message="Say hello, share a useful tip, or attach an image or video." />}<div ref={bottomRef} /></div>
          <form className="student-chat-composer" onSubmit={sendMessage}>{attachment && <div className="student-chat-attachment"><span>{attachment.type.startsWith('video/') ? <Video size={15} /> : <ImagePlus size={15} />}{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={15} /></button></div>}<div><input value={draft} maxLength="2000" onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" aria-label="Message" /><input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={chooseAttachment} /><button type="button" className="icon-button" onClick={() => fileInput.current?.click()} aria-label="Attach image or video" title="Attach image or video"><ImagePlus size={18} /></button><Button type="submit" loading={sending} disabled={sending || (!draft.trim() && !attachment)} aria-label="Send message"><Send size={17} /></Button></div><small>Images and videos up to 25 MB · abusive words and contact details are blocked.</small></form>
        </> : <div className="student-chat-room-empty"><MessageCircle size={28} /><h2>Choose a student chat</h2><p>Accept a request or search for another student by username to start a private conversation.</p></div>}
      </section>
    </div>
  </div>
}
