import type { Locale } from "../config";

import { en, type Dictionary } from "./en";
import { fr } from "./fr";
import { rw } from "./rw";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { en, fr, rw };

/** The interface text for a language. Small and synchronous, so client components can use it too. */
export function dictionary(lang: Locale): Dictionary {
  return dictionaries[lang];
}
