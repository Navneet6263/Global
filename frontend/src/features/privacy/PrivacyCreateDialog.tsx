import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPrivacyRecord, privacyLabel, type PrivacyKind } from "@/lib/backend-api/privacy";

export const privacyInput =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";

export function PrivacyCreateDialog({
  kind,
  onClose,
  onCreated,
}: {
  kind: PrivacyKind;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const cache = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectReference, setSubjectReference] = useState("");
  const [requestType, setRequestType] = useState("ACCESS");
  const [severity, setSeverity] = useState("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createPrivacyRecord({
        kind,
        title: title.trim(),
        description: description.trim(),
        ...(kind === "DATA_REQUEST"
          ? { subjectReference: subjectReference.trim(), requestType }
          : { severity }),
        ...(dueAt ? { dueAt: new Date(`${dueAt}T17:00:00`).toISOString() } : {}),
      }),
    onSuccess: (record) => {
      toast.success("Privacy record created");
      void cache.invalidateQueries({ queryKey: ["privacy"] });
      onCreated(record.id);
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>
            {kind === "DATA_REQUEST" ? "Record a data request" : "Record a privacy incident"}
          </DialogTitle>
          <DialogDescription>
            Use a short case or ticket reference. Do not paste identity documents, passwords or raw
            personal data.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="block space-y-1.5 text-xs font-medium">
            Title
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={5}
              maxLength={160}
              placeholder="Short description of the work"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "DATA_REQUEST" ? (
              <>
                <label className="block space-y-1.5 text-xs font-medium">
                  Request type
                  <select
                    className={privacyInput}
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                  >
                    {["ACCESS", "CORRECTION", "ERASURE", "OTHER"].map((value) => (
                      <option key={value} value={value}>
                        {privacyLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs font-medium">
                  Subject / case reference
                  <Input
                    value={subjectReference}
                    onChange={(e) => setSubjectReference(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="Case number or internal ticket"
                  />
                </label>
              </>
            ) : (
              <label className="block space-y-1.5 text-xs font-medium">
                Recorded severity
                <select
                  className={privacyInput}
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                    <option key={value} value={value}>
                      {privacyLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1.5 text-xs font-medium">
              Review target date (optional)
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-medium">
            Context for the reviewer
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${privacyInput} min-h-28`}
              placeholder="Record the request or known incident facts and who should review them."
            />
          </label>
          {requestType === "ERASURE" && kind === "DATA_REQUEST" ? (
            <p className="rounded-xl bg-warning-soft p-3 text-xs text-warning-foreground">
              Erasure requests are logged for authorised human review. Creating or approving this
              record does not delete application data or backups.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={
                create.isPending || title.trim().length < 5 || description.trim().length < 10
              }
              loading={create.isPending}
              type="submit"
            >
              {create.isPending ? "Recording…" : "Create record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
