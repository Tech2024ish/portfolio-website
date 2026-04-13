import React from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useInView } from '../hooks/useInView'

function CertCard({ item, issued, index }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 100}ms` }}
      className={`bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-teal-500 transition-all duration-500 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-teal-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <span className="text-xs text-teal-400 font-semibold bg-teal-900/40 px-2.5 py-1 rounded-full">
          {issued} {item.year}
        </span>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
      <p className="text-teal-400 text-sm font-medium mb-3">{item.issuer}</p>
      <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
    </div>
  )
}

export default function Certifications() {
  const { t } = useLanguage()
  const [ref, inView] = useInView()

  return (
    <section id="certifications" className="py-24 bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p className="text-teal-400 font-semibold uppercase tracking-widest text-sm mb-2">
            {t.certifications.sectionLabel}
          </p>
          <h2 className="text-4xl font-extrabold text-white">{t.certifications.title}</h2>
          <div className="mt-4 w-16 h-1 bg-teal-600 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.certifications.items.map((item, i) => (
            <CertCard key={i} item={item} issued={t.certifications.issued} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
