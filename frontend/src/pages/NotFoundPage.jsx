import { Link } from 'react-router'
import { useLanguage } from '../context/LanguageContext'
import { useDocumentMeta } from '../hooks/usePageEffects'

export default function NotFoundPage({ message }) {
  const { ui } = useLanguage()
  useDocumentMeta({ title: ui.common.notFoundTitle })
  return (
    <section className="section-pad page-top not-found">
      <span className="eyebrow">404</span>
      <h1 className="page-title">{ui.common.notFoundTitle}</h1>
      <p>{message || ui.common.notFoundBody}</p>
      <Link className="button primary" to="/">
        {ui.common.home} <span aria-hidden="true">&rarr;</span>
      </Link>
    </section>
  )
}
