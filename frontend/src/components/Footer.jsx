import React from "react";

const navLinks = [
  { label: "About", href: "#hero" },
  { label: "Projects", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xl font-bold text-white">Jean Claude ISHIMWE</p>

          <nav>
            <ul className="flex flex-wrap gap-6 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <p className="text-sm">
            &copy; {new Date().getFullYear()} Jean Claude. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
