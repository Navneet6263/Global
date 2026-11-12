import { FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateRejectionReason } from "@/lib/backend-api/clarifications";

export function DataEntryL2RejectBox({
  reason,
  onChangeReason,
  busy,
  submitting,
  onCancel,
  onConfirm,
}: {
  reason: string;
  onChangeReason: (value: string) => void;
  busy: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const trimmedLen = reason.trim().length;
  const validationError = trimmedLen > 0 ? validateRejectionReason(reason) : null;
  const valid = validateRejectionReason(reason) === null;

  return (
    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
      <div className="flex items-center justify-between text-xs font-semibold text-rose-950">
        <span className="inline-flex items-center gap-1.5">
          <FileWarning className="size-4 text-rose-600" />
          Reject submitted document & return to candidate
        </span>
        <span className="text-[11px] font-normal">{trimmedLen}/1000 · min 5</span>
      </div>
      <textarea
        value={reason}
        onChange={(event) => onChangeReason(event.target.value)}
        maxLength={1000}
        rows={3}
        disabled={busy}
        placeholder="Explain clearly why the uploaded document cannot be accepted (5–1000 characters)…"
        aria-label="Rejection reason"
        className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs outline-none"
      />
      {validationError ? <p className="text-[11px] text-rose-700">{validationError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={!valid || busy}
          onClick={onConfirm}
        >
          {submitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Confirm Reject & Request Re-upload
        </Button>
      </div>
    </div>
  );
}
