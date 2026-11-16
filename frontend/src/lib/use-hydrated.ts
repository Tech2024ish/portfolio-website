import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during server rendering and hydration, true once React controls the page. Forms use it
 * to stay disabled until JavaScript handles them, so they can never fall back to a native submit
 * (which, as a GET, would put the values in the URL).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
