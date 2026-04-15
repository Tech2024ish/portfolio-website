import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const SUPABASE_URL = "https://fitbjtryrzrjlygbsrhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_60qIprPzMyB0_jniDFCLig_EKx_lbxF";

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
    href: "https://www.linkedin.com/in/ishimwe-jean-claude-goslish/",
  },
];

export default function Footer() {
  const { t } = useLanguage();
  const [visitCount, setVisitCount] = useState(null);

  useEffect(() => {
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    // Insert a visit row, then count total rows
    fetch(`${SUPABASE_URL}/rest/v1/visits`, { method: "POST", headers, body: "{}" })
      .finally(() => {
        fetch(`${SUPABASE_URL}/rest/v1/visits?select=id`, {
          headers: { ...headers, Prefer: "count=exact" },
        }).then((res) => {
          const count = parseInt(res.headers.get("content-range")?.split("/")[1] ?? "0");
          setVisitCount(count);
        }).catch(() => {});
      });
  }, []);

  return (
    <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">Jean Claude ISHIMWE</p>
            <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">Kigali, Rwanda &middot; claudeish88@gmail.com</p>
          </div>

          <nav>
            <ul className="flex flex-wrap gap-6 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-gray-900 dark:hover:text-white transition-colors">
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
                className="px-4 py-1.5 border border-gray-300 dark:border-gray-700 rounded-full hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-center text-xs text-gray-400 dark:text-gray-600">
            &copy; {new Date().getFullYear()} Jean Claude ISHIMWE. All rights reserved.
          </p>
          {visitCount !== null && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-600">
              {visitCount.toLocaleString()} {t.visitCounter.label}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
