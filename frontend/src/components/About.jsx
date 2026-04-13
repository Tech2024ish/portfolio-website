import React from "react";
import { useLanguage } from "../context/LanguageContext";

export default function About() {
  const { t } = useLanguage();

  return (
    <section id="about" className="py-24 bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-teal-400 font-semibold uppercase tracking-widest text-sm mb-2">
            {t.about.sectionLabel}
          </p>
          <h2 className="text-4xl font-extrabold text-white">{t.about.title}</h2>
          <div className="mt-4 w-16 h-1 bg-teal-600 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Education */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-1">{t.about.educationTitle}</h3>
            <div className="w-10 h-0.5 bg-teal-500 mb-6" />
            <p className="text-lg font-semibold text-gray-100">{t.about.degree}</p>
            <p className="text-teal-400 font-medium mt-1">{t.about.university}</p>
            <p className="text-gray-500 text-sm mt-1">{t.about.expectedGrad}</p>

            <p className="text-gray-400 font-medium mt-6 mb-3 text-sm uppercase tracking-wider">
              {t.about.courseworkLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {t.about.coursework.map((course) => (
                <span
                  key={course}
                  className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-full border border-gray-600"
                >
                  {course}
                </span>
              ))}
            </div>
          </div>

          {/* Achievements & Info */}
          <div className="flex flex-col gap-8">
            {/* Achievements */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-1">{t.about.achievementsTitle}</h3>
              <div className="w-10 h-0.5 bg-teal-500 mb-6" />
              <ul className="space-y-3">
                {t.about.achievements.map((item) => (
                  <li key={item} className="flex gap-3 text-gray-400 text-sm leading-relaxed">
                    <span className="text-teal-400 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Languages & Interests */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-1">{t.about.langInterestTitle}</h3>
              <div className="w-10 h-0.5 bg-teal-500 mb-6" />
              <div className="flex gap-4 mb-5">
                <span className="px-3 py-1 bg-teal-900 text-teal-300 text-sm font-medium rounded-full">
                  {t.about.english}
                </span>
                <span className="px-3 py-1 bg-teal-900 text-teal-300 text-sm font-medium rounded-full">
                  {t.about.kinyarwanda}
                </span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{t.about.interests}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
