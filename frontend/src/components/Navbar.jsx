import React, { useState, useEffect } from "react";
import profilePic from "../images/profile_pic.png";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

const languages = [
  { code: "en", label: "EN", full: "English" },
  { code: "fr", label: "FR", full: "Français" },
  { code: "rw", label: "RW", full: "Kinyarwanda" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { dark, setDark } = useTheme();

  const navLinks = [
    { label: t.nav.home, href: "#hero" },
    { label: t.nav.about, href: "#about" },
    { label: t.nav.services, href: "#services" },
    { label: t.nav.projects, href: "#projects" },
    { label: t.nav.skills, href: "#skills" },
    { label: t.nav.certifications, href: "#certifications" },
    { label: t.nav.gallery, href: "#gallery" },
    { label: t.nav.contact, href: "#contact" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white dark:bg-gray-900 shadow-md"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#hero">
          <img
            src={profilePic}
            alt="Jean Claude ISHIMWE"
            className="w-10 h-10 rounded-full object-cover border-2 border-teal-600"
          />
        </a>

        {/* Desktop links */}
        <ul className="hidden md:flex gap-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 font-medium transition-colors"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {dark ? (
              // Sun icon — switch to light
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              // Moon icon — switch to dark
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 text-sm font-medium hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              {languages.find((l) => l.code === language)?.label}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      language === lang.code
                        ? "bg-teal-600 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {lang.full}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          <span className={`block w-6 h-0.5 bg-gray-700 dark:bg-gray-200 transition-transform duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-6 h-0.5 bg-gray-700 dark:bg-gray-200 transition-opacity duration-300 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-6 h-0.5 bg-gray-700 dark:bg-gray-200 transition-transform duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-6 py-4 shadow-md">
          <ul className="flex flex-col gap-4 mb-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
            {/* Mobile theme toggle */}
            <button
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
              className="px-3 py-1 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              {dark ? "Light" : "Dark"}
            </button>
            {/* Mobile language switcher */}
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code); setMenuOpen(false); }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === lang.code
                    ? "bg-teal-600 text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-700"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
