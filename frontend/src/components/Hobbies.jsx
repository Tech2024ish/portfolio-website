import { useLanguage } from '../context/LanguageContext'
import { useInView } from '../hooks/useInView'

const icons = [
  // Football
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0v4m0 16v-4m-8-8h4m12 0h-4M5.636 5.636l2.828 2.828m7.072 7.072l2.828 2.828M5.636 18.364l2.828-2.828m7.072-7.072l2.828-2.828" /></svg>,
  // Reading
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  // Swimming
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M3 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M12 4a2 2 0 100-4 2 2 0 000 4z" /></svg>,
  // Movies
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  // Technical Writing
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  // Music
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
]

const iconBgs = [
  'bg-green-500',
  'bg-yellow-600',
  'bg-blue-500',
  'bg-red-600',
  'bg-purple-600',
  'bg-indigo-500',
]

function HobbyCard({ hobby, icon, iconBg, index }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 80}ms` }}
      className={`bg-gray-900/60 dark:bg-gray-800/60 border border-gray-700 dark:border-gray-700 rounded-2xl p-6 transition-all duration-500 hover:border-teal-500 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center text-white mb-5`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-3">{hobby.title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed mb-5">{hobby.description}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {hobby.tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 text-xs font-medium text-teal-300 border border-teal-700 bg-teal-950/50 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
      {hobby.link && (
        <a
          href={hobby.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
        >
          {hobby.linkLabel}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      )}
    </div>
  )
}

export default function Hobbies() {
  const { t } = useLanguage()
  const [ref, inView] = useInView()

  return (
    <section id="hobbies" className="py-24 bg-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <span className="inline-block text-xs font-semibold tracking-widest text-teal-400 uppercase mb-3 px-4 py-1.5 bg-teal-900/40 border border-teal-800 rounded-full">
            {t.hobbies.sectionLabel}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mt-3">
            {t.hobbies.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.hobbies.items.map((hobby, i) => (
            <HobbyCard
              key={i}
              hobby={hobby}
              icon={icons[i]}
              iconBg={iconBgs[i]}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
