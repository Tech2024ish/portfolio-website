import { notFound } from "next/navigation";

/** Unknown Studio addresses show the Studio's 404 page (app/owner/not-found.tsx). */
export default function MissingStudioPage() {
  notFound();
}
