import profilePic from "../images/profile_pic.png";
import { useLanguage } from "../context/LanguageContext";
import { useTypewriter } from "../hooks/useTypewriter";

export default function Hero() {
  const { t } = useLanguage();
  const typed = useTypewriter(t.hero.typewords);

  return (
    <section
      id="hero"
      className="min-h-screen flex items-center pt-16 bg-gradient-to-br from-white via-teal-50 to-white dark:from-gray-950 dark:via-teal-950 dark:to-gray-950"
    >
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row items-center gap-16">

          {/* Text */}
          <div className="flex-1 max-w-2xl">
            {/* Location badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-full text-teal-700 dark:text-teal-300 text-xs font-semibold tracking-wide mb-6">
              <span>📍</span> Kigali, Rwanda
            </div>

            <p className="text-teal-600 dark:text-teal-400 font-semibold mb-3 tracking-widest uppercase text-sm">
              {t.hero.welcome}
            </p>
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight">
              Hi, I&apos;m{" "}
              <span className="text-teal-600 dark:text-teal-400">Jean Claude</span>
            </h1>

            {/* Typewriter subtitle */}
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-500 dark:text-gray-400 mb-6 min-h-[2.5rem]">
              <span>{typed}</span>
              <span className="inline-block w-0.5 h-7 bg-teal-500 ml-1 animate-pulse align-middle" />
            </h2>


            <div className="flex flex-wrap gap-4">
              <a
                href="#projects"
                className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-md"
              >
                {t.hero.viewProjects}
              </a>
              <a
                href="#contact"
                className="px-6 py-3 border-2 border-teal-500 text-teal-600 dark:text-teal-400 font-semibold rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950 transition-colors"
              >
                {t.hero.contactMe}
              </a>
              <a
                href="/CV.pdf"
                download="Jean_Claude_ISHIMWE_CV.pdf"
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold rounded-lg hover:border-gray-500 dark:hover:border-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {t.hero.downloadCV}
              </a>
            </div>

            {/* Stats row — bigger & bolder */}
            <div className="mt-12 grid grid-cols-4 gap-4 border-t border-gray-200 dark:border-gray-800 pt-8">
              {t.stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-4xl font-extrabold text-teal-600 dark:text-teal-400 leading-none">{stat.value}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Tech badges */}
            <div className="mt-8 flex flex-wrap gap-3">
              {["Python", "Java", "JavaScript", "C", "SQL", "HTML & CSS", "PostgreSQL", "Git", "DSA"].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-full"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Profile photo — large portrait */}
          <div className="flex-shrink-0">
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-teal-500 shadow-2xl shadow-teal-200/50 dark:shadow-teal-900/50">
              <img
                src={profilePic}
                alt="Jean Claude ISHIMWE"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
