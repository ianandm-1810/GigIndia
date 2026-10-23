import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={22} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export function EmptyState({ title, message, action }) {
  return (
    <section className="state-panel state-empty" aria-live="polite">
      <span className="state-icon"><Inbox size={22} aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  )
}

export function ErrorState({ message = 'Something went wrong. Please try again.', action }) {
  return (
    <section className="state-panel state-error" role="alert">
      <span className="state-icon"><AlertCircle size={22} aria-hidden="true" /></span>
      <p>{message}</p>
      {action}
    </section>
  )
}
