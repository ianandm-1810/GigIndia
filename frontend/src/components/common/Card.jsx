export default function Card({ children, className = '', as: Element = 'section', ...props }) {
  return <Element className={['surface-card', className].filter(Boolean).join(' ')} {...props}>{children}</Element>
}
