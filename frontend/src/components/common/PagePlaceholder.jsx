export default function PagePlaceholder({ title, description }) {
  return (
    <section className="page-placeholder" aria-labelledby="page-title">
      <p className="page-eyebrow">GIGI India frontend</p>
      <h1 className="page-title" id="page-title">{title}</h1>
      <p className="page-description">{description}</p>
      <p>This page is a structural placeholder. The visual design and page behavior will be added after the product direction is provided.</p>
    </section>
  )
}
