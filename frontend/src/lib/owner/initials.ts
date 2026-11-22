// Plain helper with no client-only code, so Server and Client Components can both import it.

/** Initials for the avatar: the first letters of the first two words of the name. */
export function initialsOf(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]!.toUpperCase());
  return letters.join("") || (email[0]?.toUpperCase() ?? "?");
}
