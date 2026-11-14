import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { Dialog } from "./dialog";
import { ToastProvider, useToast, type ToastInput } from "./toast";

function Trigger({ input }: { input: ToastInput }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(input)}>
      Notify
    </button>
  );
}

function setup(input: ToastInput) {
  render(
    <ToastProvider>
      <Trigger input={input} />
    </ToastProvider>,
  );
  return () => fireEvent.click(screen.getByRole("button", { name: "Notify" }));
}

const region = () => screen.getByRole("region", { name: "Notifications" });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ToastProvider", () => {
  it("renders its live regions before any toast, so announcements are reliable", () => {
    setup({ title: "Saved" });
    const live = region().querySelectorAll("[aria-live]");
    expect([...live].map((element) => element.getAttribute("aria-live"))).toEqual(["polite", "assertive"]);
  });

  it("puts danger toasts in the assertive region and others in the polite one", () => {
    render(
      <ToastProvider>
        <Trigger input={{ title: "Saved", tone: "success" }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(region().querySelector('[aria-live="polite"]')).toHaveTextContent("Saved");
    expect(region().querySelector('[aria-live="assertive"]')).toBeEmptyDOMElement();
  });

  it("dismisses after its duration", () => {
    const notify = setup({ title: "Saved", duration: 3000 });
    notify();
    expect(within(region()).getByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2999));
    expect(within(region()).queryByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(within(region()).queryByText("Saved")).toBeNull();
  });

  it("pauses while hovered and resumes with the remaining time", () => {
    const notify = setup({ title: "Saved", duration: 3000 });
    notify();
    act(() => vi.advanceTimersByTime(1000));
    const toast = within(region()).getByText("Saved").closest("div.pointer-events-auto") as HTMLElement;
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(10_000));
    expect(within(region()).queryByText("Saved")).toBeInTheDocument();
    fireEvent.pointerLeave(toast);
    act(() => vi.advanceTimersByTime(1999));
    expect(within(region()).queryByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(within(region()).queryByText("Saved")).toBeNull();
  });

  it("stays until dismissed when duration is 0, and the dismiss button names the toast", () => {
    const notify = setup({ title: "Upload failed", tone: "danger", duration: 0 });
    notify();
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification: Upload failed" }));
    expect(within(region()).queryByText("Upload failed")).toBeNull();
  });

  it("shows at most three toasts, dropping the oldest", () => {
    let count = 0;
    function Many() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast({ title: `Toast ${++count}` })}>
          Many
        </button>
      );
    }
    render(
      <ToastProvider>
        <Many />
      </ToastProvider>,
    );
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Many" }));
    const titles = within(region())
      .getAllByText(/^Toast \d$/)
      .map((element) => element.textContent);
    expect(titles).toEqual(["Toast 2", "Toast 3", "Toast 4"]);
  });

  it("renders text, never markup", () => {
    const notify = setup({ title: "<img src=x onerror=alert(1)>", description: "<b>bold</b>" });
    notify();
    expect(region().querySelector("img")).toBeNull();
    expect(region().querySelector("b")).toBeNull();
    expect(within(region()).getByText("<b>bold</b>")).toBeInTheDocument();
  });

  it("has no accessibility violations with a toast showing", async () => {
    vi.useRealTimers();
    const notify = setup({ title: "Saved", description: "Your changes are live.", tone: "success" });
    notify();
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe("useToast", () => {
  it("fails loudly outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger input={{ title: "x" }} />)).toThrow(
      "useToast must be used inside a ToastProvider",
    );
  });
});

describe("toasts and modal dialogs", () => {
  // Everything outside a modal dialog is inert: hidden from assistive technology and
  // unreachable. Toasts raised while a dialog is open must therefore render inside it.
  function Harness() {
    const toast = useToast();
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit profile">
          <button type="button" onClick={() => toast({ title: "Link copied", duration: 0 })}>
            Copy link
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              toast({ title: "Profile saved", duration: 0 });
            }}
          >
            Save
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </Dialog>
      </>
    );
  }

  function renderHarness() {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    return screen.getByRole("dialog", { hidden: true });
  }

  it("shows a toast raised while a dialog is open inside that dialog, in a live region", () => {
    const dialog = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    const live = within(dialog).getByText("Link copied").closest("[aria-live]");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(dialog).toContainElement(live as HTMLElement);
    expect(within(region()).queryByText("Link copied")).toBeNull();
  });

  it("sends a toast raised while closing the dialog to the page, not the closing dialog", () => {
    const dialog = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(within(dialog).queryByText("Profile saved")).toBeNull();
    const live = within(region()).getByText("Profile saved").closest("[aria-live]");
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("keeps a dialog's toast visible after it closes, outside the live regions", () => {
    const dialog = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(within(dialog).queryByText("Link copied")).toBeNull();
    const carried = within(region()).getByText("Link copied");
    // Already announced inside the dialog: not added to a live region a second time.
    expect(carried.closest("[aria-live]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification: Link copied" }));
    expect(within(region()).queryByText("Link copied")).toBeNull();
  });

  it("renders the dialog's live regions before its first toast", () => {
    const dialog = renderHarness();
    const live = [...dialog.querySelectorAll("[aria-live]")].map((element) =>
      element.getAttribute("aria-live"),
    );
    expect(live).toEqual(["polite", "assertive"]);
  });
});
