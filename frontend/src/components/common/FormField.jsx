export default function FormField({ label, htmlFor, error, hint, children }) {
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error" id={htmlFor + '-error'}>{error}</p>}
    </div>
  )
}
