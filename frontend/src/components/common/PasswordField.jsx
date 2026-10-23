import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordField({ label, id, hint, error, className = '', ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="form-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          className={'field-input password-field-input ' + className}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + '-error' : hint ? id + '-hint' : undefined}
          {...inputProps}
        />
        <button
          className="password-visibility-toggle"
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {hint && !error && <p className="field-hint" id={id + '-hint'}>{hint}</p>}
      {error && <p className="field-error" id={id + '-error'}>{error}</p>}
    </div>
  )
}
