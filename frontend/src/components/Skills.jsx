import React, { useEffect, useState } from 'react'
import { getSkills } from '../api'
import { useLanguage } from '../context/LanguageContext'

const fallbackSkills = [
  { id: 1, name: 'Python', category: 'Language', level: 85 },
  { id: 2, name: 'Java', category: 'Language', level: 74 },
  { id: 3, name: 'JavaScript', category: 'Language', level: 70 },
  { id: 4, name: 'HTML & CSS', category: 'Frontend', level: 80 },
  { id: 5, name: 'PostgreSQL', category: 'Database', level: 72 },
  { id: 6, name: 'Git & GitHub', category: 'Tools', level: 84 },
  { id: 7, name: 'Problem Solving', category: 'Soft Skills', level: 88 },
  { id: 8, name: 'VS Code / IntelliJ', category: 'Tools', level: 80 },
]

const categoryColors = {
  Language: 'bg-purple-900 text-purple-300',
  Frontend: 'bg-yellow-900 text-yellow-300',
  Database: 'bg-emerald-900 text-emerald-300',
  Tools: 'bg-gray-700 text-gray-300',
  'Soft Skills': 'bg-pink-900 text-pink-300',
}

export default function Skills() {
  const { t } = useLanguage()
  const [skills, setSkills] = useState(fallbackSkills)

  useEffect(() => {
    getSkills()
      .then((res) => {
        if (res.data && res.data.length > 0) setSkills(res.data)
      })
      .catch(() => {})
  }, [])

  return (
    <section id="skills" className="py-24 bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-indigo-400 font-semibold uppercase tracking-widest text-sm mb-2">
            {t.skills.sectionLabel}
          </p>
          <h2 className="text-4xl font-extrabold text-white">{t.skills.title}</h2>
          <div className="mt-4 w-16 h-1 bg-indigo-600 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {skills.map((skill) => (
            <div key={skill.id} className="bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-100">{skill.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[skill.category] ?? 'bg-gray-700 text-gray-300'}`}>
                    {skill.category}
                  </span>
                </div>
                <span className="text-sm font-semibold text-indigo-400">{skill.level}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${skill.level}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
