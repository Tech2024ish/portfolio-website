import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { Button } from "./button";
import { ConfirmDialog, Dialog } from "./dialog";

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit profile</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit profile"
        description="Changes are saved when you press Save."
        dismissible={dismissible}
        footer={<Button onClick={() => setOpen(false)}>Save</Button>}
      >
        <p>Form goes here.</p>
      </Dialog>
    </>
  );
}

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("Dialog", () => {
  it("opens as a modal labelled and described by its title and description", () => {
    render(<Harness />);
    expect(dialog()).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(dialog()).toHaveAttribute("open");
    expect(dialog()).toHaveAccessibleName("Edit profile");
    expect(dialog()).toHaveAccessibleDescription("Changes are saved when you press Save.");
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("closes on Escape (cancel), restores focus and releases the scroll lock", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Edit profile" });
    opener.focus();
    fireEvent.click(opener);
    const cancel = new Event("cancel", { cancelable: true });
    act(() => {
      dialog().dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true); // the component, not the browser, closes it
    expect(dialog()).not.toHaveAttribute("open");
    expect(opener).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes from the close button and from a backdrop click, but not from a click inside", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.click(screen.getByText("Form goes here."));
    expect(dialog()).toHaveAttribute("open");
    fireEvent.pointerDown(dialog()); // press and release on the backdrop
    fireEvent.click(dialog());
    expect(dialog()).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(dialog()).not.toHaveAttribute("open");
  });

  it("stays open when a drag starts inside and ends over the backdrop", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.pointerDown(screen.getByText("Form goes here."));
    fireEvent.click(dialog()); // the browser targets the common ancestor: the <dialog>
    expect(dialog()).toHaveAttribute("open");
  });

  it("cannot be dismissed when dismissible is false", () => {
    render(<Harness dismissible={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    act(() => {
      dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(dialog()).toHaveAttribute("open");
    expect(screen.queryByRole("button", { name: "Close dialog" })).toBeNull();
  });

  it("keeps the page locked while an outer dialog is still open", () => {
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <>
          <Dialog open={outer} onClose={() => setOuter(false)} title="Outer">
            <Button onClick={() => setOuter(false)}>Close outer</Button>
          </Dialog>
          <Dialog open={inner} onClose={() => setInner(false)} title="Inner">
            <Button onClick={() => setInner(false)}>Close inner</Button>
          </Dialog>
        </>
      );
    }
    render(<Nested />);
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close inner", hidden: true }));
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close outer", hidden: true }));
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("releases the scroll lock if it unmounts while open", () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    unmount();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("has no accessibility violations when open", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe("ConfirmDialog", () => {
  function Confirm({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        tone="danger"
        title="Delete project?"
        description="This removes the project and its images. It cannot be undone."
        confirmLabel="Delete project"
        onConfirm={async () => {
          await onConfirm();
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    );
  }

  it("focuses Cancel first for destructive actions and styles the confirm button as danger", () => {
    render(<Confirm onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Delete project" }).className).toContain("bg-danger-strong");
  });

  it("focuses the confirm button first for non-destructive actions", () => {
    render(
      <ConfirmDialog
        open
        title="Publish?"
        description="It becomes public."
        confirmLabel="Publish"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toHaveFocus();
  });

  it("shows progress and blocks dismissal while an async confirm runs, then closes", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Confirm onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    expect(screen.getByRole("button", { name: "Delete project" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    act(() => {
      dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(dialog()).toHaveAttribute("open");
    await act(async () => finish());
    expect(dialog()).not.toHaveAttribute("open");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("stays open when confirm fails, so the caller can report the error", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network");
    });
    function Failing() {
      return (
        <ConfirmDialog
          open
          title="Delete?"
          description="Gone for good."
          tone="danger"
          onConfirm={async () => {
            try {
              await failing();
            } catch {
              // The caller reports the failure (e.g. with an Alert or toast).
            }
          }}
          onCancel={() => {}}
        />
      );
    }
    render(<Failing />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm" })));
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Confirm" })).not.toHaveAttribute("aria-busy");
  });
});
