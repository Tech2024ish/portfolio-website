import React from "react";

export default function Hero() {
  return (
    <section
      id="hero"
      className="min-h-screen flex items-center pt-16 bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950"
    >
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-indigo-600 font-semibold mb-3 tracking-widest uppercase text-sm">
            Welcome to my portfolio
          </p>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight">
            Hi, I&apos;m{" "}
            <span className="text-indigo-600">Jean Claude ISHIMWE</span>
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-400 mb-6">
            Backend Developer
          </h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            I build reliable, scalable backend systems using{" "}
            <span className="font-medium text-gray-200">Python</span> and{" "}
            <span className="font-medium text-gray-200">FastAPI</span>, with{" "}
            <span className="font-medium text-gray-200">Supabase</span> as my
            go-to database. Passionate about clean APIs and solid architecture.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#projects"
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
            >
              View Projects
            </a>
            <a
              href="#contact"
              className="px-6 py-3 border-2 border-indigo-400 text-indigo-400 font-semibold rounded-lg hover:bg-indigo-950 transition-colors"
            >
              Contact Me
            </a>
          </div>

          {/* Tech badges */}
          <div className="mt-14 flex flex-wrap gap-3">
            {[
              "Python",
              "FastAPI",
              "Supabase",
              "PostgreSQL",
              "Docker",
              "REST APIs",
            ].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium rounded-full"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
