export default function Field({ label, id, hint, error, className = '', ...inputProps }) {
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input className={'field-input ' + className} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : hint ? id + '-hint' : undefined} {...inputProps} />
      {hint && !error && <p className="field-hint" id={id + '-hint'}>{hint}</p>}
      {error && <p className="field-error" id={id + '-error'}>{error}</p>}
    </div>
  )
}
