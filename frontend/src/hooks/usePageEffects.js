import { useEffect } from 'react'

const DEFAULT_TITLE = 'Jean Claude Ishimwe | Backend Software Engineer'

function setMeta(selector, attr, value) {
  const node = document.head.querySelector(selector)
  if (node && value) node.setAttribute(attr, value)
}

/** Per-page <title> and description (crawlers that run JS and link previews in-app). */
export function useDocumentMeta({ title, description, image } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | Jean Claude Ishimwe` : DEFAULT_TITLE
    document.title = fullTitle
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:image"]', 'content', image)
  }, [title, description, image])
}

/** Fade-in for `.reveal` elements; re-scans whenever `deps` change. */
export function useReveal(deps = []) {
  useEffect(() => {
    const items = document.querySelectorAll('.reveal:not(.is-visible)')
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }),
      { threshold: 0.12 },
    )
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
