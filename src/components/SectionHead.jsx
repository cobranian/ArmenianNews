import { KnotMark } from './Ornament.jsx'

export function SectionHead({ eyebrow, title, subtitle }) {
  return (
    <div className="section__head reveal">
      {eyebrow && <div className="section__eyebrow">{eyebrow}</div>}
      <h2 className="section__title">{title}</h2>
      <KnotMark />
      {subtitle && <p className="section__subtitle">{subtitle}</p>}
    </div>
  )
}
