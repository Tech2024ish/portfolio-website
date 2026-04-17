import { useLanguage } from '../context/LanguageContext'
import { useInView } from '../hooks/useInView'

export default function Writing() {
  const { t } = useLanguage()
  const [ref, inView] = useInView()

  return (
    <section id="writing" className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 px-4 py-1.5 bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-full">
              {t.writing.sectionLabel}
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mt-3">
              {t.writing.title}
            </h2>
            <p className="mt-6 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {t.writing.subtitle}
            </p>
          </div>

          <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-lg">{t.writing.comingSoon}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
