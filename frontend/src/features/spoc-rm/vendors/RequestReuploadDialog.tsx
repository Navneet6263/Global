import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TONE_BADGE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";
import { dateTime } from "../utils/spoc-format";
import { isValidVendorText, VENDOR_TEXT_MAX } from "./spoc-vendor-model";

export interface RequestReuploadDialogProps {
  open: boolean;
  documentLabel: string;
  rejection: { vendor: string; reason: string | null } | null;
  candidateLink: { active: boolean; expiresAt: string } | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string) => void;
}

/**
 * Sends a vendor-rejected document back to the candidate. The candidate sees only
 * this message on their existing link, never the vendor's internal reason.
 */
export function RequestReuploadDialog(props: RequestReuploadDialogProps) {
  const [message, setMessage] = useState("");
  const ready = isValidVendorText(message);

  useEffect(() => {
    if (!props.open) setMessage("");
  }, [props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask the candidate to re-upload</DialogTitle>
          <DialogDescription>
            {props.documentLabel}. The document moves to “Re-upload required” on the candidate’s
            existing link.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) props.onSubmit(message.trim());
          }}
        >
          {props.rejection ? (
            <div className={cn("rounded-2xl border px-3 py-2 text-xs", TONE_BADGE.critical)}>
              <p className="font-semibold">
                Rejected by {props.rejection.vendor} · internal, not shown to the candidate
              </p>
              <p className="mt-0.5 break-words whitespace-pre-wrap">{props.rejection.reason}</p>
            </div>
          ) : null}
          <div>
            <Label className="mb-1.5 block text-xs">Message to the candidate (required)</Label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={VENDOR_TEXT_MAX}
              rows={4}
              placeholder="For example: please upload a clear, complete copy of your degree certificate"
            />
            {message && !ready ? (
              <p className="mt-1 text-[11px] text-critical-foreground">
                Write at least 5 characters.
              </p>
            ) : null}
          </div>
          <p
            className={cn(
              "rounded-2xl border px-3 py-2 text-[11px]",
              TONE_BADGE[props.candidateLink ? "info" : "warning"],
            )}
          >
            {props.candidateLink
              ? `Candidate link is active until ${dateTime(props.candidateLink.expiresAt)}.`
              : "The candidate has no active link. Ask Operations to re-issue it so they can upload."}
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || props.busy} loading={props.busy}>
              Send for re-upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
