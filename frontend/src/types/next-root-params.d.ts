// Next.js generates the `next/root-params` types during `next dev` and `next build` only, and CI
// type-checks a fresh checkout before building. This declares the one root parameter of this app
// (app/[lang]); it matches what Next generates, so the two declarations merge without conflict.
declare module "next/root-params" {
  export function lang(): Promise<string>;
}
