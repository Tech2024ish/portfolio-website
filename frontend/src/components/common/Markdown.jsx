import { lazy, Suspense } from 'react'

// The Markdown parser is only needed on case-study and article pages,
// so it is split out of the main bundle.
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'))

export default function Markdown({ children, className = 'prose' }) {
  return (
    <Suspense fallback={<div className={className}>{children}</div>}>
      <MarkdownRenderer className={className}>{children}</MarkdownRenderer>
    </Suspense>
  )
}
