import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useInView } from "../hooks/useInView";
import { getGallery } from "../api";

function prettyName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")        // strip extension
    .replace(/[-_]/g, " ")          // dashes/underscores → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}

function GalleryCard({ item, index, inView, onClick }) {
  return (
    <div
      className={`group relative rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-500 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
      onClick={onClick}
    >
      <div className="h-52 overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={item.url}
          alt={item.label}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {item.label}
        </h3>
      </div>

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
    </div>
  );
}

export default function PhotoGallery() {
  const { t } = useLanguage();
  const [ref, inView] = useInView(0.1);
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGallery()
      .then((res) => {
        setPhotos(
          res.data.map((f) => ({ ...f, label: prettyName(f.name) }))
        );
      })
      .catch(() => setError("Could not load gallery."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="gallery" ref={ref} className="pt-8 pb-16 bg-gray-50 dark:bg-gray-900">
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

        {/* States */}
        {loading && (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm">Loading gallery…</p>
        )}
        {error && (
          <p className="text-center text-red-400 text-sm">{error}</p>
        )}

        {/* Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map((item, i) => (
              <GalleryCard
                key={item.name}
                item={item}
                index={i}
                inView={inView}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selected.url}
              alt={selected.label}
              className="w-full max-h-72 object-cover"
            />
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {selected.label}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
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
