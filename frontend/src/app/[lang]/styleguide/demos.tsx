"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field, Input } from "@/components/ui/form";
import { ToastProvider, useToast } from "@/components/ui/toast";

/** Interactive component demos for the development-only styleguide. */

function OverlayDemos() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastAction, setLastAction] = useState("None yet");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Open dialog
        </Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Delete project
        </Button>
        <DropdownMenu
          label="Project actions"
          items={[
            { label: "Edit", onSelect: () => setLastAction("Edit") },
            { label: "Duplicate", onSelect: () => setLastAction("Duplicate"), disabled: true },
            { label: "Publish", onSelect: () => setLastAction("Publish") },
            { label: "Delete", onSelect: () => setLastAction("Delete"), tone: "danger" },
          ]}
        />
        <Button variant="ghost" onClick={() => toast({ title: "Project saved", tone: "success" })}>
          Success toast
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            toast({
              title: "Upload failed",
              description: "The image is larger than 8 MB.",
              tone: "danger",
              duration: 0,
            })
          }
        >
          Error toast
        </Button>
      </div>
      <p className="text-sm text-muted" data-testid="last-action">
        Last menu action: {lastAction}
      </p>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Edit profile"
        description="Changes are saved when you press Save."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDialogOpen(false);
                toast({ title: "Profile saved", tone: "success" });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Headline">
          {(control) => <Input {...control} defaultValue="Backend Software Engineer" />}
        </Field>
        <div>
          {/* Raises a toast while the dialog stays open: it must appear inside the dialog. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast({ title: "Notification from the dialog", tone: "info", duration: 0 })}
          >
            Notify from the dialog
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="Delete project?"
        description="This removes the project and its images. It cannot be undone."
        confirmLabel="Delete project"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          setConfirmOpen(false);
          toast({ title: "Project deleted", tone: "info" });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export function InteractiveDemos() {
  return (
    <ToastProvider>
      <OverlayDemos />
    </ToastProvider>
  );
}
