import React from "react";
import profilePic from "../images/profile_pic.png";
import { useLanguage } from "../context/LanguageContext";

export default function Hero() {
  const { t } = useLanguage();

  return (
    <section
      id="hero"
      className="min-h-screen flex items-center pt-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-950"
    >
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row items-center gap-12">
          {/* Text */}
          <div className="flex-1 max-w-2xl">
            <p className="text-teal-400 font-semibold mb-3 tracking-widest uppercase text-sm">
              {t.hero.welcome}
            </p>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight">
              Hi, I&apos;m{" "}
              <span className="text-teal-400">Jean Claude ISHIMWE</span>
            </h1>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-400 mb-6">
              {t.hero.title}
            </h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              {t.hero.bio1}{" "}
              <span className="font-medium text-gray-200">{t.hero.bio2}</span>
              {t.hero.bio3}{" "}
              <span className="font-medium text-gray-200">{t.hero.bio4}</span>,{" "}
              <span className="font-medium text-gray-200">{t.hero.bio5}</span>{" "}
              {t.hero.bio6}{" "}
              <span className="font-medium text-gray-200">{t.hero.bio7}</span>
              {t.hero.bio8}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#projects"
                className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-md"
              >
                {t.hero.viewProjects}
              </a>
              <a
                href="#contact"
                className="px-6 py-3 border-2 border-teal-400 text-teal-400 font-semibold rounded-lg hover:bg-teal-950 transition-colors"
              >
                {t.hero.contactMe}
              </a>
              <a
                href="/CV.pdf"
                download
                className="px-6 py-3 border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-400 hover:text-white transition-colors"
              >
                {t.hero.downloadCV}
              </a>
            </div>

            {/* Tech badges */}
            <div className="mt-14 flex flex-wrap gap-3">
              {["Python", "Java", "JavaScript", "HTML & CSS", "PostgreSQL", "Git"].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium rounded-full"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Profile photo */}
          <div className="flex-shrink-0">
            <div className="w-52 h-52 md:w-64 md:h-64 rounded-full overflow-hidden border-4 border-teal-500 shadow-2xl shadow-teal-900/40">
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
