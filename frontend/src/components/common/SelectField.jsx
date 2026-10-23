export default function SelectField({ label, id, children, ...selectProps }) {
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <select className="field-input field-select" id={id} {...selectProps}>{children}</select>
    </div>
  )
}
