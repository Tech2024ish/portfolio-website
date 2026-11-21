import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom (30.x) has HTMLDialogElement but not showModal/show/close. This minimal stand-in lets
// unit tests exercise the Dialog component's own logic. Real modal behaviour (inert page,
// Escape, top layer, focus containment) is verified in a browser: e2e/components/*.spec.ts.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute("open")) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// `next/root-params` is a placeholder that the Next.js compiler replaces; tests stand in for it.
// Pages under app/[lang] read the language from it (default English; a test can override it).
vi.mock("next/root-params", () => ({ lang: async () => "en" }));
