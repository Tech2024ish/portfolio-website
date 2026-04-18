import { useLanguage } from '../context/LanguageContext'
import { useInView } from '../hooks/useInView'

function CertCard({ item, issued, index }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 100}ms` }}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:border-teal-500 transition-all duration-500 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          item.type === 'Leadership'
            ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
            : 'bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
        }`}>
          {item.type}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
          {issued} {item.year}
        </span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
      <p className="text-teal-600 dark:text-teal-400 text-sm font-medium mb-3">{item.issuer}</p>
      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
    </div>
  )
}

export default function Certifications() {
  const { t } = useLanguage()
  const [ref, inView] = useInView()

  return (
    <section id="certifications" className="py-24 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <span className="inline-block text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 px-4 py-1.5 bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-full">
            {t.certifications.sectionLabel}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mt-3">
            {t.certifications.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {t.certifications.items.map((item, i) => (
            <CertCard key={i} item={item} issued={t.certifications.issued} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
