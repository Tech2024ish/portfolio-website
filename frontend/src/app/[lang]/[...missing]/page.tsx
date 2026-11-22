import { notFound } from "next/navigation";

/**
 * Any address that matches no public page, in any language, shows that language's 404 page
 * (app/[lang]/not-found.tsx) inside the site's own frame.
 */
export default function Missing() {
  notFound();
}
