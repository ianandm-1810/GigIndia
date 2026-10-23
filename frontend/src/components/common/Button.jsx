import { Link } from 'react-router-dom'

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  className = '',
  loading = false,
  disabled = false,
  to,
  type = 'button',
  ...props
}) {
  const classes = ['button', 'button-' + variant, 'button-' + size, className].filter(Boolean).join(' ')
  const content = <>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</>

  if (to) {
    return <Link className={classes} to={to} aria-disabled={disabled || loading} {...props}>{content}</Link>
  }

  return (
    <button className={classes} type={type} disabled={disabled || loading} {...props}>
      {content}
    </button>
  )
}
