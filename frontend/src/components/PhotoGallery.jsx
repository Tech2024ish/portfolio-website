import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useInView } from "../hooks/useInView";

const categoryColors = {
  Academic: "from-blue-500 to-indigo-600",
  Académique: "from-blue-500 to-indigo-600",
  Amashuri: "from-blue-500 to-indigo-600",
  Learning: "from-teal-500 to-cyan-600",
  Apprentissage: "from-teal-500 to-cyan-600",
  Kwiga: "from-teal-500 to-cyan-600",
  Community: "from-green-500 to-emerald-600",
  Communauté: "from-green-500 to-emerald-600",
  Ubukorikori: "from-green-500 to-emerald-600",
  Projects: "from-violet-500 to-purple-600",
  Projets: "from-violet-500 to-purple-600",
  Imishinga: "from-violet-500 to-purple-600",
  Achievements: "from-amber-500 to-orange-600",
  Réalisations: "from-amber-500 to-orange-600",
  Intsinzi: "from-amber-500 to-orange-600",
  "Open Source": "from-rose-500 to-pink-600",
};

const categoryIcons = {
  Academic: "🎓", Académique: "🎓", Amashuri: "🎓",
  Learning: "📚", Apprentissage: "📚", Kwiga: "📚",
  Community: "🤝", Communauté: "🤝", Ubukorikori: "🤝",
  Projects: "💻", Projets: "💻", Imishinga: "💻",
  Achievements: "🏆", Réalisations: "🏆", Intsinzi: "🏆",
  "Open Source": "🌐",
};

export default function PhotoGallery() {
  const { t } = useLanguage();
  const [ref, inView] = useInView(0.1);
  const [selected, setSelected] = useState(null);

  const items = t.gallery.items;

  return (
    <section id="gallery" ref={ref} className="py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3">
            {t.gallery.sectionLabel}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t.gallery.title}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed">
            {t.gallery.subtitle}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => {
            const gradient = categoryColors[item.category] || "from-gray-500 to-gray-600";
            const icon = categoryIcons[item.category] || "📷";
            return (
              <div
                key={i}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-500 ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
                onClick={() => setSelected(item)}
              >
                {/* Gradient background panel */}
                <div className={`bg-gradient-to-br ${gradient} h-48 flex items-center justify-center`}>
                  <span className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-300">
                    {icon}
                  </span>
                </div>

                {/* Card body */}
                <div className="bg-white dark:bg-gray-800 p-5">
                  <span className="inline-block text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">
                    {item.category}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`bg-gradient-to-br ${categoryColors[selected.category] || "from-gray-500 to-gray-600"} h-40 flex items-center justify-center`}
            >
              <span className="text-7xl">{categoryIcons[selected.category] || "📷"}</span>
            </div>
            <div className="p-6">
              <span className="inline-block text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-2">
                {selected.category}
              </span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {selected.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {selected.description}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="mt-5 w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
