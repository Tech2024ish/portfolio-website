import { useLanguage } from '../context/LanguageContext'
import { useInView } from '../hooks/useInView'

function ArticleCard({ article, index }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 100}ms` }}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 hover:border-teal-500 transition-all duration-500 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 leading-snug">
        {article.title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
        {article.body}
      </p>
    </div>
  )
}

export default function Blog() {
  const { t } = useLanguage()
  const [ref, inView] = useInView()

  return (
    <section id="blog" className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <span className="inline-block text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 px-4 py-1.5 bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-full">
            {t.blog.sectionLabel}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mt-3">
            {t.blog.title}
          </h2>
          <p className="mt-6 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {t.blog.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.blog.articles.map((article, i) => (
            <ArticleCard key={i} article={article} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
