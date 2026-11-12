import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { humanize } from "@/features/cases/case-detail-formatting";
import {
  allowedDocumentTypesForCheck,
  createClarification,
  type Clarification,
} from "@/lib/api/clarifications";

export function VerifierRaiseInsufficiencyForm({
  caseId,
  checkId,
  taskId,
  checkType,
  activeClarification,
  activeStatusLabel,
}: {
  caseId: string;
  checkId: string;
  taskId: string;
  checkType: string;
  activeClarification?: Clarification;
  activeStatusLabel?: string;
}) {
  const queryClient = useQueryClient();
  const docOptions = allowedDocumentTypesForCheck(checkType);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [requestedDocType, setRequestedDocType] = useState(docOptions[0] ?? "OTHER");

  const create = useMutation({
    mutationFn: () =>
      createClarification(caseId, {
        checkId,
        subject: subject.trim(),
        message: message.trim(),
        requestedDocumentType: requestedDocType || undefined,
      }),
    onSuccess: () => {
      toast.success("Insufficiency (L2) raised", {
        description: "The candidate receives a secure upload link and notification.",
      });
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["clarifications", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "context"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!activeClarification && subject.trim().length >= 3 && message.trim().length >= 3) {
          create.mutate();
        }
      }}
      className="rounded-xl border border-warning/20 bg-warning-soft/45 p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
        <MessageSquarePlus className="size-4 text-warning-foreground" />
        <span>Raise insufficiency (L2): ask for exactly what is missing</span>
      </div>
      {activeClarification ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[12px] text-amber-950">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">An L2 clarification is already active for this check</p>
            <p className="mt-0.5 text-muted-foreground">
              “{activeClarification.subject}” · {activeStatusLabel}. Finish or await the current
              cycle before raising another one.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={180}
              placeholder="What information is missing?"
              aria-label="Insufficiency subject"
              className="h-10 rounded-xl border border-border bg-white px-3 text-[12.5px] outline-none focus:border-warning/50"
            />
            <select
              value={requestedDocType}
              onChange={(event) => setRequestedDocType(event.target.value)}
              aria-label="Requested document type"
              className="h-10 rounded-xl border border-border bg-white px-3 text-[12.5px] outline-none focus:border-warning/50"
            >
              {docOptions.map((docType) => (
                <option key={docType} value={docType}>
                  Document: {humanize(docType)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={1200}
            placeholder="State clearly what the candidate must re-upload or clarify"
            aria-label="Insufficiency instructions"
            className="rounded-xl border border-border bg-white px-3 py-2.5 text-[12.5px] outline-none focus:border-warning/50"
          />
          <button
            disabled={create.isPending || subject.trim().length < 3 || message.trim().length < 3}
            aria-busy={create.isPending}
            className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-full bg-warning px-4 py-2 text-[12.5px] font-semibold text-white transition-colors enabled:hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-amber-800/80 disabled:text-white"
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="size-3.5" />
            )}
            Raise insufficiency
          </button>
        </div>
      )}
    </form>
  );
}
