import React from "react";

const achievements = [
  "Completed courses in Cybersecurity, JavaScript, and Python Programming",
  "Active GitHub contributor with multiple personal and academic projects",
  "Strong foundation in algorithms, logical problem-solving, and attention to detail",
];

const coursework = [
  "Python Programming",
  "Java Programming",
  "Database Management",
  "Web Development",
  "Cybersecurity Fundamentals",
  "Data Structures & Algorithms",
];

export default function About() {
  return (
    <section id="about" className="py-24 bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-indigo-400 font-semibold uppercase tracking-widest text-sm mb-2">
            Background
          </p>
          <h2 className="text-4xl font-extrabold text-white">About Me</h2>
          <div className="mt-4 w-16 h-1 bg-indigo-600 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Education */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-1">Education</h3>
            <div className="w-10 h-0.5 bg-indigo-500 mb-6" />
            <p className="text-lg font-semibold text-gray-100">
              Bachelor of Computer Science
            </p>
            <p className="text-indigo-400 font-medium mt-1">University of Rwanda</p>
            <p className="text-gray-500 text-sm mt-1">Expected Graduation: 2028</p>

            <p className="text-gray-400 font-medium mt-6 mb-3 text-sm uppercase tracking-wider">
              Relevant Coursework
            </p>
            <div className="flex flex-wrap gap-2">
              {coursework.map((course) => (
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
              <h3 className="text-xl font-bold text-white mb-1">Achievements</h3>
              <div className="w-10 h-0.5 bg-indigo-500 mb-6" />
              <ul className="space-y-3">
                {achievements.map((item) => (
                  <li key={item} className="flex gap-3 text-gray-400 text-sm leading-relaxed">
                    <span className="text-indigo-400 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Languages & Interests */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-1">Languages &amp; Interests</h3>
              <div className="w-10 h-0.5 bg-indigo-500 mb-6" />
              <div className="flex gap-4 mb-5">
                <span className="px-3 py-1 bg-indigo-900 text-indigo-300 text-sm font-medium rounded-full">
                  English — Fluent
                </span>
                <span className="px-3 py-1 bg-indigo-900 text-indigo-300 text-sm font-medium rounded-full">
                  Kinyarwanda — Native
                </span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Web &amp; Mobile Development · AI &amp; Machine Learning · Digital Service Solutions · Tech Communities · Hackathons
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
