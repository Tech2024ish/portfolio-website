import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/owner/login-form";
import { cardClasses } from "@/components/ui/section";
import { getOwnerSession } from "@/lib/owner/session";
import { safeNext } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Sign in" };

type LoginPageProps = { searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // Already signed in: go straight to the Studio.
  if ((await getOwnerSession()).status === "signed-in") redirect(next);

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className={`${cardClasses} flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8`}>
        <div className="flex flex-col gap-2">
          <p className="font-mono text-sm text-accent">Owner Studio</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Sign in</h1>
          <p className="text-sm text-muted">This area is for the site owner only.</p>
        </div>
        <LoginForm next={next} expired={params.reason === "expired"} />
        <Link
          href="/"
          className="inline-flex min-h-6 items-center text-sm text-muted underline underline-offset-4 hover:text-fg"
        >
          Back to the site
        </Link>
      </div>
    </main>
  );
}
