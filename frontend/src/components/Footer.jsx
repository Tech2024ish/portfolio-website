import React from "react";

const navLinks = [
  { label: "About", href: "#hero" },
  { label: "Projects", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
];

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/Tech2024ish",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/jean-claude-ishimwe",
  },
];

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xl font-bold text-white">Jean Claude ISHIMWE</p>
            <p className="text-sm mt-1 text-gray-500">Kigali, Rwanda &middot; claudeish88@gmail.com</p>
          </div>

          <nav>
            <ul className="flex flex-wrap gap-6 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex gap-4 text-sm">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 border border-gray-700 rounded-full hover:border-indigo-400 hover:text-indigo-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          &copy; {new Date().getFullYear()} Jean Claude ISHIMWE. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
