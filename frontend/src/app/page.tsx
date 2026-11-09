import { buttonClasses } from "@/components/ui/button";

/**
 * Phase 1 placeholder. Proves the toolchain, fonts and design tokens end to end.
 * Replaced by the real public portfolio in Phase 6.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-8 px-4 py-16 sm:px-8">
      <p className="w-fit rounded-pill bg-success-soft px-3 py-1 text-sm text-success">Rebuild in progress</p>
      <h1 className="font-display text-4xl font-bold tracking-tight text-fg sm:text-display">
        Jean Claude Ishimwe
      </h1>
      <p className="max-w-2xl text-body text-muted">
        Backend Software Engineer in Kigali, Rwanda. Python · FastAPI · PostgreSQL · REST APIs.
      </p>
      <div className="flex flex-wrap gap-3">
        <a className={buttonClasses("primary")} href="https://github.com/Tech2024ish">
          GitHub
        </a>
        <a className={buttonClasses("secondary")} href="/Resume.pdf">
          Download CV
        </a>
      </div>
    </main>
  );
}
