import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// react-markdown does not render raw HTML by default, so owner-written content
// cannot inject script. Links are restricted to safe protocols.
const safeUrl = (url) => (/^(https?:|mailto:|\/|#)/i.test(url) ? url : '')

const components = {
  a: ({ href, children, ...props }) => {
    const external = /^https?:/i.test(href || '')
    return (
      <a href={href} {...props} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {children}
      </a>
    )
  },
  img: ({ alt, ...props }) => <img alt={alt || ''} loading="lazy" {...props} />,
}

export default function Markdown({ children, className = 'prose' }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrl} components={components}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
